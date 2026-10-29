// src/features/snap-video/videoDownloadService.js
// Service xử lý tải video từ 4 nền tảng MXH: TikTok, YouTube, Facebook, Instagram
// Tích hợp multi-source resolver (TikWM, Piped YouTube, FDown Facebook, Instagram Embed)

import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';

const REQUEST_TIMEOUT_MS = 25000;

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
async function expandShortUrl(rawUrl) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
      },
      signal: controller.signal,
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
// 1. TIKTOK RESOLVER (TikWM API không watermark)
// ============================================================
async function resolveTikTok(url, mode) {
  const targetUrl = await expandShortUrl(url);
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`;

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Máy chủ TikTok phản hồi lỗi (${response.status})`);
  }

  const json = await response.json();
  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || 'Không tìm thấy video TikTok. Hãy kiểm tra lại link công khai.');
  }

  const data = json.data;
  let downloadUrl = '';

  if (mode === 'audio') {
    downloadUrl = data.music || data.music_info?.play;
    if (!downloadUrl) downloadUrl = data.play;
  } else {
    downloadUrl = data.play || data.wmplay || data.hdplay;
  }

  if (!downloadUrl) {
    throw new Error('Không trích xuất được link tải video TikTok.');
  }

  return {
    url: downloadUrl,
    filename: `tiktok_${data.id || Date.now()}.${mode === 'audio' ? 'mp3' : 'mp4'}`,
  };
}

// ============================================================
// 2. YOUTUBE RESOLVER (Piped API Streams)
// ============================================================
async function resolveYouTube(url, mode) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new Error('Không nhận dạng được ID video YouTube từ liên kết này.');
  }

  const pipedInstances = [
    'https://api.piped.private.coffee',
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.ducks.party',
  ];

  let lastError = null;

  for (const instance of pipedInstances) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${instance}/streams/${videoId}`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const data = await res.json();
      if (!data) continue;

      if (mode === 'audio') {
        const audio = data.audioStreams?.[0];
        if (audio?.url) {
          return {
            url: audio.url,
            filename: `youtube_${videoId}.m4a`,
          };
        }
      }

      // Ưu tiên định dạng MPEG_4 (mp4) xem được trên iOS Photos
      const mp4Stream = data.videoStreams?.find((s) => s.format === 'MPEG_4' && s.url);
      const anyStream = data.videoStreams?.[0];
      const targetStream = mp4Stream || anyStream;

      if (targetStream?.url) {
        return {
          url: targetStream.url,
          filename: `youtube_${videoId}.mp4`,
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error('Không thể tải video YouTube từ máy chủ này. Video có thể bị giới hạn độ tuổi hoặc bản quyền.' + (lastError ? ` (${lastError.message})` : ''));
}

// ============================================================
// 3. FACEBOOK RESOLVER (FDown Engine)
// ============================================================
async function resolveFacebook(url, mode) {
  const expanded = await expandShortUrl(url);

  const response = await fetch('https://fdown.co.in/ajax', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://fdown.co.in',
      'Referer': 'https://fdown.co.in/',
    },
    body: JSON.stringify({ url: expanded }),
  });

  if (!response.ok) {
    throw new Error(`Máy chủ Facebook phản hồi mã ${response.status}`);
  }

  const data = await response.json();
  if (!data || !data.success || !data.links) {
    throw new Error(data?.message || 'Không thể lấy video Facebook. Video có thể ở chế độ riêng tư.');
  }

  // Lấy link video tải về (ưu tiên HD hoặc video link đầu tiên)
  const links = data.links;
  const downloadUrl = links['Download Video in HD Quality'] || links['Download Video'] || Object.values(links)[0];

  if (!downloadUrl || typeof downloadUrl !== 'string' || !downloadUrl.startsWith('http')) {
    throw new Error('Không tìm thấy link tải video Facebook khả dụng.');
  }

  return {
    url: downloadUrl,
    filename: `facebook_${Date.now()}.${mode === 'audio' ? 'mp3' : 'mp4'}`,
  };
}

// ============================================================
// 4. INSTAGRAM RESOLVER (Instagram Embed Scraper)
// ============================================================
async function resolveInstagram(url, mode) {
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

  // Fallback qua snapinsta.lc
  try {
    const snapRes = await fetch('https://snapinsta.lc/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://snapinsta.lc',
        'Referer': 'https://snapinsta.lc/',
      },
      body: `q=${encodeURIComponent(url)}&scope=home&lang=en`,
    });

    const text = await snapRes.text();
    const mediaMatch = text.match(/data-media-src="([^"]+)"/);
    if (mediaMatch && mediaMatch[1]) {
      return {
        url: mediaMatch[1],
        filename: `instagram_${shortcode}.${mode === 'audio' ? 'mp3' : 'mp4'}`,
      };
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
 * @returns {Promise<{url: string, filename: string}>}
 */
export async function fetchDownloadLink(rawUrl, mode = 'video') {
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
    resolverPromise = resolveTikTok(url, mode);
  } else if (platform.id === 'youtube') {
    resolverPromise = resolveYouTube(url, mode);
  } else if (platform.id === 'facebook') {
    resolverPromise = resolveFacebook(url, mode);
  } else if (platform.id === 'instagram') {
    resolverPromise = resolveInstagram(url, mode);
  } else {
    throw new Error('Nền tảng chưa được hỗ trợ.');
  }

  return Promise.race([resolverPromise, timeoutPromise]);
}

/**
 * Tải video về máy và lưu vào thư viện ảnh
 * @param {string} downloadUrl - URL trực tiếp để tải file
 * @param {string} filename - Tên file
 * @param {function} onProgress - Callback tiến trình (0-1)
 * @returns {Promise<{uri: string, savedToGallery: boolean}>}
 */
export async function downloadAndSaveVideo(downloadUrl, filename, onProgress) {
  const safeName = (filename || `video_${Date.now()}.mp4`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  const fileUri = `${baseDir}${safeName}`;

  const downloadResumable = FileSystem.createDownloadResumable(
    downloadUrl,
    fileUri,
    {},
    (downloadProgress) => {
      if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
        const progress = Math.min(1, Math.max(0, downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite));
        onProgress(progress);
      }
    }
  );

  const result = await downloadResumable.downloadAsync();

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
