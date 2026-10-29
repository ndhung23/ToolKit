// src/features/snap-video/videoDownloadService.js
// Service xử lý tải video từ 4 nền tảng MXH: TikTok, YouTube, Facebook, Instagram
// Tích hợp multi-source resolver và hỗ trợ hủy tải video bất kỳ lúc nào

import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';

const REQUEST_TIMEOUT_MS = 10000;

// 4 Nền tảng được hỗ trợ theo yêu cầu
export const SUPPORTED_PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', icon: 'logo-tiktok', color: '#000000', patterns: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'] },
  { id: 'youtube', name: 'YouTube', icon: 'logo-youtube', color: '#FF0000', patterns: ['youtube.com', 'youtu.be', 'youtube.com/shorts'] },
  { id: 'facebook', name: 'Facebook', icon: 'logo-facebook', color: '#1877F2', patterns: ['facebook.com', 'fb.watch', 'fb.com'] },
  { id: 'instagram', name: 'Instagram', icon: 'logo-instagram', color: '#E1306C', patterns: ['instagram.com'] },
];

/**
 * Nhận diện nền tảng từ URL
 */
export function detectPlatform(url) {
  if (!url || typeof url !== 'string') return null;
  const lower = url.toLowerCase();
  for (const platform of SUPPORTED_PLATFORMS) {
    for (const pattern of platform.patterns) {
      if (lower.includes(pattern)) return platform;
    }
  }
  return null;
}

/**
 * Kiểm tra URL hợp lệ
 */
export function isValidUrl(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed);
  }
}

/**
 * Giải quyết link rút gọn (redirect)
 */
async function expandShortUrl(rawUrl, signal) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const combinedSignal = signal || controller.signal;
    const res = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
      },
      signal: combinedSignal,
    });
    clearTimeout(timeout);
    return res.url || rawUrl;
  } catch {
    return rawUrl;
  }
}

/**
 * Tách Video ID của YouTube
 */
function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

/**
 * Tách Shortcode của Instagram
 */
function extractInstagramShortcode(url) {
  const match = url.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[2] : null;
}

// ============================================================
// 1. TIKTOK RESOLVER (TikWM API không watermark + Fallback)
// ============================================================
async function resolveTikTok(url, mode, signal) {
  const targetUrl = await expandShortUrl(url, signal);

  // Thử TikWM API chính thức
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal,
    });

    if (response.ok) {
      const json = await response.json();
      if (json.code === 0 && json.data) {
        const data = json.data;
        let downloadUrl = '';
        if (mode === 'audio') {
          downloadUrl = data.music || data.music_info?.play || data.play;
        } else {
          downloadUrl = data.play || data.wmplay || data.hdplay;
        }

        if (downloadUrl) {
          return {
            url: downloadUrl,
            filename: `tiktok_${data.id || Date.now()}.${mode === 'audio' ? 'mp3' : 'mp4'}`,
          };
        }
      }
    }
  } catch {
    // Fallback sang Tikwm v2
  }

  // Fallback qua Tikmate
  try {
    const fallbackRes = await fetch(`https://api.tikmate.app/api/lookup?url=${encodeURIComponent(targetUrl)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal,
    });
    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json();
      if (fbData.token && fbData.id) {
        return {
          url: `https://tikmate.app/download/${fbData.token}/${fbData.id}.mp4?hd=1`,
          filename: `tiktok_${fbData.id}.mp4`,
        };
      }
    }
  } catch {
    // ignore
  }

  throw new Error('Không thể lấy video TikTok. Hãy đảm bảo video ở chế độ công khai.');
}

// ============================================================
// 2. YOUTUBE PARALLEL MULTI-INSTANCE RESOLVER (Tốc độ cao & Xử lý song song)
// ============================================================
async function resolveYouTube(url, mode, signal) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new Error('Không nhận dạng được ID video YouTube từ liên kết này.');
  }

  // Danh sách các máy chủ phân giải Piped đang hoạt động (chạy song song để có kết quả ngay trong 1-3s)
  const servers = [
    'https://api.piped.private.coffee',
    'https://pipedapi.ducks.party',
  ];

  let botBlocked = false;

  const tryServer = async (serverUrl) => {
    if (signal?.aborted) throw new Error('Đã hủy thao tác.');
    const c = new AbortController();
    const timeout = setTimeout(() => c.abort(), 4000);
    const combinedSignal = signal || c.signal;

    try {
      const res = await fetch(`${serverUrl}/streams/${videoId}`, {
        headers: { 'Accept': 'application/json' },
        signal: combinedSignal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status === 500) {
          const errText = await res.text().catch(() => '');
          if (errText.includes('bot') || errText.includes('LOGIN_REQUIRED')) {
            botBlocked = true;
          }
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data) throw new Error('Empty data');

      if (mode === 'audio') {
        const audio = data.audioStreams?.find((a) => a.url);
        if (audio?.url) {
          return {
            url: audio.url,
            filename: `youtube_${videoId}.m4a`,
          };
        }
      }

      // Ưu tiên MP4 có tiếng + hình
      const mp4Stream = data.videoStreams?.find((st) => (st.format === 'MPEG_4' || st.mimeType?.includes('mp4')) && st.url);
      const anyStream = data.videoStreams?.find((st) => st.url);
      const chosen = mp4Stream || anyStream;

      if (chosen?.url) {
        return {
          url: chosen.url,
          filename: `youtube_${videoId}.mp4`,
        };
      }

      throw new Error('No stream found');
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  };

  try {
    return await Promise.any(servers.map((s) => tryServer(s)));
  } catch {
    if (botBlocked) {
      throw new Error('Video YouTube này đang bị YouTube áp dụng cơ chế xác minh chống bot (Botguard). Vui lòng thử video YouTube khác hoặc dùng video từ TikTok, Facebook, Instagram.');
    }
    throw new Error('Không thể phân tích video YouTube này. Vui lòng kiểm tra lại link hoặc thử video khác.');
  }
}

// ============================================================
// 3. FACEBOOK RESOLVER (FDown Engine + Fallback)
// ============================================================
async function resolveFacebook(url, mode, signal) {
  const expanded = await expandShortUrl(url, signal);

  // Máy chủ 1: FDown API
  try {
    const response = await fetch('https://fdown.co.in/ajax', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://fdown.co.in',
        'Referer': 'https://fdown.co.in/',
      },
      body: JSON.stringify({ url: expanded }),
      signal,
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.success && data.links) {
        const links = data.links;
        const downloadUrl = links['Download Video in HD Quality'] || links['Download Video'] || Object.values(links)[0];
        if (downloadUrl && typeof downloadUrl === 'string' && downloadUrl.startsWith('http')) {
          return {
            url: downloadUrl,
            filename: `facebook_${Date.now()}.${mode === 'audio' ? 'mp3' : 'mp4'}`,
          };
        }
      }
    }
  } catch {
    // Fallback tiếp theo
  }

  // Máy chủ 2: SnapSave API
  try {
    const snapRes = await fetch('https://snapsave.app/action.php?lang=vn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: `url=${encodeURIComponent(expanded)}`,
      signal,
    });
    if (snapRes.ok) {
      const html = await snapRes.text();
      const match = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
      if (match && match[1]) {
        return {
          url: match[1],
          filename: `facebook_${Date.now()}.${mode === 'audio' ? 'mp3' : 'mp4'}`,
        };
      }
    }
  } catch {
    // ignore
  }

  throw new Error('Không thể lấy video Facebook. Video có thể ở chế độ riêng tư hoặc nhóm kín.');
}

// ============================================================
// 4. INSTAGRAM RESOLVER (Instagram Embed Scraper + Fallback)
// ============================================================
async function resolveInstagram(url, mode, signal) {
  const shortcode = extractInstagramShortcode(url);
  if (!shortcode) {
    throw new Error('Không tìm thấy mã bài viết Instagram (Reel/Post).');
  }

  // Thử lấy link trực tiếp từ embed Instagram
  try {
    const embedRes = await fetch(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal,
    });

    if (embedRes.ok) {
      const html = await embedRes.text();
      const videoMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
      const displayMatch = html.match(/"display_url"\s*:\s*"([^"]+)"/);

      if (videoMatch && videoMatch[1]) {
        const cleanVideoUrl = videoMatch[1].replace(/\\u002F/g, '/').replace(/\\u0026/g, '&');
        return {
          url: cleanVideoUrl,
          filename: `instagram_${shortcode}.${mode === 'audio' ? 'mp3' : 'mp4'}`,
        };
      }

      if (displayMatch && displayMatch[1]) {
        const cleanDisplayUrl = displayMatch[1].replace(/\\u002F/g, '/').replace(/\\u0026/g, '&');
        return {
          url: cleanDisplayUrl,
          filename: `instagram_${shortcode}.jpg`,
        };
      }
    }
  } catch {
    // Fallback qua snapinsta
  }

  // Fallback qua snapinsta
  try {
    const snapRes = await fetch('https://snapinsta.lc/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Origin': 'https://snapinsta.lc',
        'Referer': 'https://snapinsta.lc/',
      },
      body: `q=${encodeURIComponent(url)}&scope=home&lang=en`,
      signal,
    });

    if (snapRes.ok) {
      const text = await snapRes.text();
      const mediaMatch = text.match(/data-media-src="([^"]+)"/);
      if (mediaMatch && mediaMatch[1]) {
        return {
          url: mediaMatch[1],
          filename: `instagram_${shortcode}.${mode === 'audio' ? 'mp3' : 'mp4'}`,
        };
      }
    }
  } catch {
    // ignore
  }

  throw new Error('Không thể lấy video Instagram. Bài viết có thể ở chế độ riêng tư.');
}

/**
 * Điều hướng tải video theo nền tảng tương ứng
 * @param {string} rawUrl - URL video cần tải
 * @param {'video' | 'audio'} mode - Chế độ tải (video hoặc chỉ audio)
 * @param {AbortSignal} signal - Signal để hủy khi cần
 * @returns {Promise<{url: string, filename: string}>}
 */
export async function fetchDownloadLink(rawUrl, mode = 'video', signal = null) {
  const url = (rawUrl || '').trim();
  const platform = detectPlatform(url);

  if (!platform) {
    throw new Error('Liên kết chưa được hỗ trợ. Snap Video hỗ trợ 4 nền tảng: TikTok, YouTube, Facebook, Instagram.');
  }

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Quá thời gian kết nối (Timeout 25s). Vui lòng thử lại.')), REQUEST_TIMEOUT_MS)
  );

  let resolverPromise;

  if (platform.id === 'tiktok') {
    resolverPromise = resolveTikTok(url, mode, signal);
  } else if (platform.id === 'youtube') {
    resolverPromise = resolveYouTube(url, mode, signal);
  } else if (platform.id === 'facebook') {
    resolverPromise = resolveFacebook(url, mode, signal);
  } else if (platform.id === 'instagram') {
    resolverPromise = resolveInstagram(url, mode, signal);
  } else {
    throw new Error('Nền tảng chưa được hỗ trợ.');
  }

  return Promise.race([resolverPromise, timeoutPromise]);
}

/**
 * Bắt đầu tải video về máy với khả năng HỦY TẢI (Cancelable)
 * @param {string} downloadUrl - URL trực tiếp để tải file
 * @param {string} filename - Tên file
 * @param {function} onProgress - Callback tiến trình (0-1)
 * @returns {{ promise: Promise<{uri: string, savedToGallery: boolean}>, cancel: () => Promise<void> }}
 */
export function startVideoDownload(downloadUrl, filename, onProgress) {
  const safeName = (filename || `video_${Date.now()}.mp4`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  const fileUri = `${baseDir}${safeName}`;

  let cancelled = false;

  const downloadResumable = FileSystem.createDownloadResumable(
    downloadUrl,
    fileUri,
    {},
    (downloadProgress) => {
      if (cancelled) return;
      if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
        const progress = Math.min(
          1,
          Math.max(0, downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite)
        );
        onProgress(progress);
      }
    }
  );

  const promise = (async () => {
    const result = await downloadResumable.downloadAsync();
    if (cancelled) {
      await cleanupTempFile(fileUri);
      throw new Error('Đã hủy tải video.');
    }

    if (!result || !result.uri) {
      throw new Error('Tải file thất bại. Vui lòng thử lại.');
    }

    // Lưu vào thư viện ảnh
    let savedToGallery = false;
    try {
      if (MediaLibrary?.requestPermissionsAsync) {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted' && MediaLibrary?.saveToLibraryAsync) {
          await MediaLibrary.saveToLibraryAsync(result.uri);
          savedToGallery = true;
        }
      }
    } catch (err) {
      console.warn('Không thể lưu vào thư viện ảnh:', err);
    }

    return {
      uri: result.uri,
      savedToGallery,
    };
  })();

  const cancel = async () => {
    cancelled = true;
    try {
      await downloadResumable.cancelAsync();
    } catch {
      // ignore
    }
    await cleanupTempFile(fileUri);
  };

  return { promise, cancel };
}

/**
 * Giữ hàm downloadAndSaveVideo cũ để tương thích ngược
 */
export async function downloadAndSaveVideo(downloadUrl, filename, onProgress) {
  const handle = startVideoDownload(downloadUrl, filename, onProgress);
  return handle.promise;
}

/**
 * Xóa file tạm sau khi đã lưu
 */
export async function cleanupTempFile(uri) {
  try {
    if (!uri) return;
    const info = await FileSystem.getInfoAsync(uri);
    if (info && info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Bỏ qua lỗi cleanup
  }
}
