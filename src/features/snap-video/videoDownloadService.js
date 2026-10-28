// src/features/snap-video/videoDownloadService.js
// Service xử lý tải video từ nhiều nền tảng MXH (TikTok, Facebook, Instagram, YouTube...)
// Sử dụng Cobalt API (open-source, miễn phí, không quảng cáo)

import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';

// Cobalt public API endpoint
const COBALT_API = 'https://api.cobalt.tools';

// Các nền tảng được hỗ trợ
export const SUPPORTED_PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', icon: 'logo-tiktok', color: '#000000', patterns: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'] },
  { id: 'youtube', name: 'YouTube', icon: 'logo-youtube', color: '#FF0000', patterns: ['youtube.com', 'youtu.be', 'youtube.com/shorts'] },
  { id: 'facebook', name: 'Facebook', icon: 'logo-facebook', color: '#1877F2', patterns: ['facebook.com', 'fb.watch', 'fb.com'] },
  { id: 'instagram', name: 'Instagram', icon: 'logo-instagram', color: '#E1306C', patterns: ['instagram.com'] },
  { id: 'twitter', name: 'X (Twitter)', icon: 'logo-twitter', color: '#1DA1F2', patterns: ['twitter.com', 'x.com'] },
  { id: 'douyin', name: 'Douyin', icon: 'musical-notes', color: '#FE2C55', patterns: ['douyin.com'] },
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
 * Kiểm tra URL có hợp lệ không
 */
export function isValidUrl(text) {
  if (!text || typeof text !== 'string') return false;
  try {
    const url = new URL(text.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Gọi Cobalt API để lấy link tải video
 * @param {string} url - URL video cần tải
 * @param {'video' | 'audio'} mode - Chế độ tải (video hoặc chỉ audio)
 * @returns {Promise<{url: string, filename: string}>}
 */
export async function fetchDownloadLink(url, mode = 'video') {
  const body = {
    url: url.trim(),
    downloadMode: mode === 'audio' ? 'audio' : 'auto',
    filenameStyle: 'basic',
  };

  const response = await fetch(`${COBALT_API}/`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Máy chủ phản hồi lỗi (${response.status}). ${errorText}`);
  }

  const data = await response.json();

  if (data.status === 'error') {
    throw new Error(data.error?.code || 'Không thể xử lý video. Vui lòng kiểm tra lại link.');
  }

  if (data.status === 'redirect' || data.status === 'tunnel' || data.status === 'stream') {
    return {
      url: data.url,
      filename: data.filename || `snap_video_${Date.now()}.mp4`,
    };
  }

  // Trường hợp picker (nhiều lựa chọn): lấy item đầu tiên
  if (data.status === 'picker' && data.picker && data.picker.length > 0) {
    const firstItem = data.picker[0];
    return {
      url: firstItem.url,
      filename: firstItem.filename || `snap_video_${Date.now()}.mp4`,
    };
  }

  throw new Error('Không nhận được link tải. Video có thể bị hạn chế hoặc nền tảng không hỗ trợ.');
}

/**
 * Tải video về máy và lưu vào thư viện ảnh
 * @param {string} downloadUrl - URL trực tiếp để tải file
 * @param {string} filename - Tên file
 * @param {function} onProgress - Callback tiến trình (0-1)
 * @returns {Promise<{uri: string, savedToGallery: boolean}>}
 */
export async function downloadAndSaveVideo(downloadUrl, filename, onProgress) {
  // Đảm bảo tên file hợp lệ
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileUri = `${FileSystem.documentDirectory}${safeName}`;

  // Tải file
  const downloadResumable = FileSystem.createDownloadResumable(
    downloadUrl,
    fileUri,
    {},
    (downloadProgress) => {
      if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
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
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status === 'granted') {
      await MediaLibrary.saveToLibraryAsync(result.uri);
      savedToGallery = true;
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
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Bỏ qua lỗi cleanup
  }
}

