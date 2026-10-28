// src/features/snap-video/SnapVideoScreen.js
// Màn hình tải video từ mạng xã hội (TikTok, Facebook, Instagram, YouTube, X, Douyin)
// Tương tự tính năng Snap Video trên phimtat.vn

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  Platform,
  Animated,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';
import {
  SUPPORTED_PLATFORMS,
  detectPlatform,
  isValidUrl,
  fetchDownloadLink,
  downloadAndSaveVideo,
  cleanupTempFile,
} from './videoDownloadService';

// Lịch sử tải gần đây (trong phiên)
const MAX_HISTORY = 20;

export default function SnapVideoScreen({ navigation }) {
  const { colors } = useTheme();
  const [url, setUrl] = useState('');
  const [downloadMode, setDownloadMode] = useState('video'); // 'video' | 'audio'
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [history, setHistory] = useState([]);
  const [detectedPlatform, setDetectedPlatform] = useState(null);
  const inputRef = useRef(null);
  const [progressAnim] = useState(() => new Animated.Value(0));

  // Cập nhật platform khi URL thay đổi
  const handleUrlChange = useCallback((text) => {
    setUrl(text);
    const platform = detectPlatform(text);
    setDetectedPlatform(platform);
  }, []);

  // Dán link từ clipboard
  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && isValidUrl(text)) {
        handleUrlChange(text.trim());
      } else {
        Alert.alert('Không tìm thấy link', 'Clipboard không chứa link hợp lệ. Hãy sao chép link video từ ứng dụng mạng xã hội.');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể đọc clipboard.');
    }
  }, [handleUrlChange]);

  // Xóa link
  const handleClear = useCallback(() => {
    setUrl('');
    setDetectedPlatform(null);
    setStatusText('');
    setProgress(0);
    progressAnim.setValue(0);
  }, [progressAnim]);

  // Bắt đầu tải video
  const handleDownload = useCallback(async () => {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      Alert.alert('Thiếu link', 'Vui lòng dán link video từ TikTok, YouTube, Facebook, Instagram...');
      return;
    }

    if (!isValidUrl(trimmedUrl)) {
      Alert.alert('Link không hợp lệ', 'Vui lòng kiểm tra lại link video.');
      return;
    }

    setLoading(true);
    setProgress(0);
    progressAnim.setValue(0);
    setStatusText('Đang phân tích link...');

    try {
      // Bước 1: Lấy link tải từ API
      const downloadInfo = await fetchDownloadLink(trimmedUrl, downloadMode);

      setStatusText('Đang tải video...');

      // Bước 2: Tải và lưu file
      const result = await downloadAndSaveVideo(
        downloadInfo.url,
        downloadInfo.filename,
        (p) => {
          setProgress(p);
          Animated.timing(progressAnim, {
            toValue: p,
            duration: 200,
            useNativeDriver: false,
          }).start();
        }
      );

      // Bước 3: Thêm vào lịch sử
      const historyItem = {
        id: Date.now().toString(),
        url: trimmedUrl,
        platform: detectedPlatform,
        mode: downloadMode,
        savedToGallery: result.savedToGallery,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      };

      setHistory((prev) => [historyItem, ...prev].slice(0, MAX_HISTORY));

      // Bước 4: Dọn file tạm
      if (result.savedToGallery) {
        await cleanupTempFile(result.uri);
      }

      setStatusText('');
      setProgress(0);
      progressAnim.setValue(0);

      Alert.alert(
        'Tải thành công! 🎉',
        result.savedToGallery
          ? `${downloadMode === 'audio' ? 'Audio' : 'Video'} đã được lưu vào thư viện ảnh của bạn.`
          : `${downloadMode === 'audio' ? 'Audio' : 'Video'} đã tải xong nhưng không thể lưu vào thư viện ảnh. Kiểm tra quyền truy cập.`
      );
    } catch (err) {
      setStatusText('');
      setProgress(0);
      progressAnim.setValue(0);
      Alert.alert(
        'Tải thất bại',
        err.message || 'Đã xảy ra lỗi. Vui lòng kiểm tra link và thử lại.'
      );
    } finally {
      setLoading(false);
    }
  }, [url, downloadMode, detectedPlatform, progressAnim]);

  // Render platform chip
  const renderPlatformChip = useCallback(({ item }) => (
    <View style={[styles.platformChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Ionicons name={item.icon} size={16} color={item.color} />
      <Text style={[styles.platformChipText, { color: colors.sub }]}>{item.name}</Text>
    </View>
  ), [colors]);

  // Render lịch sử tải
  const renderHistoryItem = useCallback(({ item }) => (
    <View style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={[styles.historyIconCircle, { backgroundColor: item.platform?.color || colors.primary + '20' }]}>
        <Ionicons
          name={item.platform?.icon || 'download'}
          size={18}
          color="#FFFFFF"
        />
      </View>
      <View style={styles.historyInfo}>
        <Text style={[styles.historyPlatform, { color: colors.text }]} numberOfLines={1}>
          {item.platform?.name || 'Video'} • {item.mode === 'audio' ? '🎵 Audio' : '🎬 Video'}
        </Text>
        <Text style={[styles.historyUrl, { color: colors.sub }]} numberOfLines={1}>
          {item.url}
        </Text>
      </View>
      <View style={styles.historyMeta}>
        <Ionicons
          name={item.savedToGallery ? 'checkmark-circle' : 'alert-circle'}
          size={16}
          color={item.savedToGallery ? colors.success : colors.danger}
        />
        <Text style={[styles.historyTime, { color: colors.sub }]}>{item.timestamp}</Text>
      </View>
    </View>
  ), [colors]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Snap Video"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderHistoryItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            {/* Banner giới thiệu */}
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={[styles.heroIconCircle, { backgroundColor: '#FF2D55' }]}>
                <Ionicons name="download" size={32} color="#FFFFFF" />
              </View>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Tải video không logo</Text>
              <Text style={[styles.heroDesc, { color: colors.sub }]}>
                Dán link video từ TikTok, YouTube, Facebook, Instagram... và tải về máy nhanh chóng, không dính watermark.
              </Text>
            </View>

            {/* Danh sách nền tảng hỗ trợ */}
            <FlatList
              data={SUPPORTED_PLATFORMS}
              keyExtractor={(item) => item.id}
              renderItem={renderPlatformChip}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.platformList}
            />

            {/* Input URL */}
            <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Link video</Text>

              <View style={[
                styles.inputRow,
                {
                  borderColor: detectedPlatform ? detectedPlatform.color : colors.border,
                  backgroundColor: colors.bg,
                },
              ]}>
                {detectedPlatform && (
                  <Ionicons
                    name={detectedPlatform.icon}
                    size={20}
                    color={detectedPlatform.color}
                    style={styles.inputPlatformIcon}
                  />
                )}
                <TextInput
                  ref={inputRef}
                  style={[styles.input, { color: colors.text }]}
                  value={url}
                  onChangeText={handleUrlChange}
                  placeholder="Dán link video vào đây..."
                  placeholderTextColor={colors.sub}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={handleDownload}
                  editable={!loading}
                  accessibilityLabel="Link video"
                />
                {url.length > 0 && !loading && (
                  <Pressable onPress={handleClear} hitSlop={8} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={20} color={colors.sub} />
                  </Pressable>
                )}
              </View>

              {/* Nút Dán link */}
              <Pressable
                onPress={handlePaste}
                disabled={loading}
                style={[styles.pasteBtn, { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder }]}
              >
                <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
                <Text style={[styles.pasteBtnText, { color: colors.primary }]}>Dán link từ clipboard</Text>
              </Pressable>

              {/* Chọn chế độ tải: Video / Audio */}
              <View style={styles.modeRow}>
                <Pressable
                  onPress={() => setDownloadMode('video')}
                  disabled={loading}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: downloadMode === 'video' ? '#FF2D55' : colors.cardElevated,
                      borderColor: downloadMode === 'video' ? '#FF2D55' : colors.cardBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="videocam"
                    size={18}
                    color={downloadMode === 'video' ? '#FFFFFF' : colors.sub}
                  />
                  <Text style={[
                    styles.modeBtnText,
                    { color: downloadMode === 'video' ? '#FFFFFF' : colors.sub },
                  ]}>
                    Video
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setDownloadMode('audio')}
                  disabled={loading}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: downloadMode === 'audio' ? '#8B5CF6' : colors.cardElevated,
                      borderColor: downloadMode === 'audio' ? '#8B5CF6' : colors.cardBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="musical-notes"
                    size={18}
                    color={downloadMode === 'audio' ? '#FFFFFF' : colors.sub}
                  />
                  <Text style={[
                    styles.modeBtnText,
                    { color: downloadMode === 'audio' ? '#FFFFFF' : colors.sub },
                  ]}>
                    Audio
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Thanh tiến trình */}
            {loading && (
              <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.progressHeader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.progressText, { color: colors.text }]}>{statusText}</Text>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: colors.bg }]}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      { width: progressWidth, backgroundColor: '#FF2D55' },
                    ]}
                  />
                </View>
                {progress > 0 && (
                  <Text style={[styles.progressPercent, { color: colors.sub }]}>
                    {Math.round(progress * 100)}%
                  </Text>
                )}
              </View>
            )}

            {/* Nút Tải Video */}
            <Pressable
              onPress={handleDownload}
              disabled={loading || !url.trim()}
              style={[
                styles.downloadBtn,
                {
                  backgroundColor: loading || !url.trim() ? colors.cardElevated : '#FF2D55',
                  opacity: loading || !url.trim() ? 0.5 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="download" size={22} color="#FFFFFF" />
              )}
              <Text style={styles.downloadBtnText}>
                {loading
                  ? 'Đang xử lý...'
                  : downloadMode === 'audio'
                    ? 'Tải Audio'
                    : 'Tải Video'}
              </Text>
            </Pressable>

            {/* Tiêu đề lịch sử */}
            {history.length > 0 && (
              <View style={styles.historyHeader}>
                <Text style={[styles.historyTitle, { color: colors.text }]}>Đã tải gần đây</Text>
                <Pressable
                  onPress={() => setHistory([])}
                  hitSlop={8}
                >
                  <Text style={[styles.historyClear, { color: colors.danger }]}>Xóa</Text>
                </Pressable>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="film-outline" size={48} color={colors.sub} />
              <Text style={[styles.emptyText, { color: colors.sub }]}>
                Chưa có video nào được tải trong phiên này
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Hero card
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  heroIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },

  // Platform chips
  platformList: {
    paddingBottom: 16,
    gap: 8,
  },
  platformChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  platformChipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Input card
  inputCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 50,
  },
  inputPlatformIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },

  // Paste button
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    gap: 8,
  },
  pasteBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Mode selector
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Progress
  progressCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 6,
  },

  // Download button
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 10,
  },
  downloadBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // History
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  historyClear: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  historyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyInfo: {
    flex: 1,
  },
  historyPlatform: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  historyUrl: {
    fontSize: 12,
    fontWeight: '500',
  },
  historyMeta: {
    alignItems: 'center',
    gap: 4,
  },
  historyTime: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

