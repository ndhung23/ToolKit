// src/features/voice-text/VoiceTextScreen.js
// Màn hình chuyển đổi giọng nói <-> văn bản (2 chiều)
// Tính năng: Giọng nói → Văn bản | Văn bản → Giọng nói
// Tương tự phím tắt trên phimtat.vn/chuyen-giong-noi-thanh-van-ban/

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  FlatList,
  Platform,
  Animated,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';

// Danh sách ngôn ngữ hỗ trợ
const LANGUAGES = [
  { code: 'vi-VN', label: 'Tiếng Việt 🇻🇳' },
  { code: 'en-US', label: 'English 🇺🇸' },
  { code: 'ja-JP', label: '日本語 🇯🇵' },
  { code: 'ko-KR', label: '한국어 🇰🇷' },
  { code: 'zh-CN', label: '中文 🇨🇳' },
  { code: 'fr-FR', label: 'Français 🇫🇷' },
];

const TAB_STT = 'stt'; // Speech to Text
const TAB_TTS = 'tts'; // Text to Speech

export default function VoiceTextScreen({ navigation }) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState(TAB_STT);

  // --- Giọng nói → Văn bản (STT) ---
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [sttLang, setSttLang] = useState('vi-VN');
  const [sttHistory, setSttHistory] = useState([]);
  const [hasSttPermission, setHasSttPermission] = useState(null);

  // --- Văn bản → Giọng nói (TTS) ---
  const [ttsText, setTtsText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsLang, setTtsLang] = useState('vi-VN');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechPitch, setSpeechPitch] = useState(1.0);

  // Animation cho nút mic
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  // Yêu cầu quyền mic khi mount
  useEffect(() => {
    requestSttPermission();
    return () => {
      // Dọn dẹp khi unmount
      ExpoSpeechRecognitionModule.abort();
      Speech.stop();
    };
  }, []);

  // Đăng ký event listeners cho Speech Recognition (phải ở top-level, không trong callback)
  useSpeechRecognitionEvent('result', (event) => {
    if (event.isFinal) {
      const finalText = event.results[0]?.transcript || '';
      setTranscript((prev) => (prev ? prev + ' ' + finalText : finalText));
      setPartialTranscript('');
      setIsListening(false);
    } else {
      setPartialTranscript(event.results[0]?.transcript || '');
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    setPartialTranscript('');
    if (event.error !== 'aborted' && event.error !== 'no-speech') {
      Alert.alert('Lỗi nhận dạng', 'Không nhận được giọng nói. Thử lại nhé!');
    }
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    setPartialTranscript('');
  });

  // Animation pulse khi đang nghe
  useEffect(() => {
    if (isListening) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      if (pulseLoop.current) pulseLoop.current.stop();
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  const requestSttPermission = async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setHasSttPermission(result.granted);
    } catch {
      setHasSttPermission(false);
    }
  };

  const startListening = useCallback(async () => {
    if (hasSttPermission === false) {
      Alert.alert(
        'Cần quyền micro',
        'Vui lòng cấp quyền micro để sử dụng tính năng này.',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Cấp quyền', onPress: requestSttPermission },
        ]
      );
      return;
    }

    try {
      setPartialTranscript('');
      setIsListening(true);

      ExpoSpeechRecognitionModule.start({
        lang: sttLang,
        interimResults: true,
        continuous: false,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'free_form',
        },
      });

      ExpoSpeechRecognition.useSpeechRecognitionEvent('result', (event) => {
        if (event.isFinal) {
          const finalText = event.results[0]?.transcript || '';
          setTranscript((prev) => (prev ? prev + ' ' + finalText : finalText));
          setPartialTranscript('');
          setIsListening(false);
        } else {
          setPartialTranscript(event.results[0]?.transcript || '');
        }
      });

      ExpoSpeechRecognition.useSpeechRecognitionEvent('error', (event) => {
        setIsListening(false);
        setPartialTranscript('');
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          Alert.alert('Lỗi nhận dạng', 'Không nhận được giọng nói. Thử lại nhé!');
        }
      });

      ExpoSpeechRecognition.useSpeechRecognitionEvent('end', () => {
        setIsListening(false);
        setPartialTranscript('');
      });
    } catch (err) {
      setIsListening(false);
      Alert.alert('Lỗi', err.message || 'Không thể khởi động nhận dạng giọng nói.');
    }
  }, [hasSttPermission, sttLang]);

  // ============================================================
  // STT: DỪNG NGHE
  // ============================================================
  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
    if (partialTranscript) {
      setTranscript((prev) => (prev ? prev + ' ' + partialTranscript : partialTranscript));
      setPartialTranscript('');
    }
  }, [partialTranscript]);

  // Lưu vào lịch sử
  const saveToHistory = useCallback(() => {
    if (!transcript.trim()) return;
    setSttHistory((prev) => [
      {
        id: Date.now().toString(),
        text: transcript.trim(),
        lang: sttLang,
        time: new Date().toLocaleTimeString('vi-VN'),
      },
      ...prev,
    ].slice(0, 30));
    setTranscript('');
    setPartialTranscript('');
    Alert.alert('Đã lưu ✅', 'Văn bản đã được lưu vào lịch sử.');
  }, [transcript, sttLang]);

  // Copy
  const copyTranscript = useCallback(async (text) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Đã sao chép ✅', 'Văn bản đã được sao chép vào clipboard.');
  }, []);

  // Xóa transcript
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setPartialTranscript('');
  }, []);

  // ============================================================
  // TTS: ĐỌC VĂN BẢN
  // ============================================================
  const handleSpeak = useCallback(async () => {
    const text = ttsText.trim();
    if (!text) {
      Alert.alert('Thiếu nội dung', 'Vui lòng nhập văn bản cần đọc.');
      return;
    }

    if (isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    Speech.speak(text, {
      language: ttsLang,
      rate: speechRate,
      pitch: speechPitch,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => {
        setIsSpeaking(false);
        Alert.alert('Lỗi đọc', 'Không thể đọc văn bản này.');
      },
    });
  }, [ttsText, isSpeaking, ttsLang, speechRate, speechPitch]);

  const stopSpeaking = useCallback(async () => {
    await Speech.stop();
    setIsSpeaking(false);
  }, []);

  // ============================================================
  // RENDER PHẦN STT
  // ============================================================
  const renderSttTab = () => (
    <>
      {/* Chọn ngôn ngữ */}
      <View style={styles.langRow}>
        {LANGUAGES.map((lang) => (
          <Pressable
            key={lang.code}
            onPress={() => setSttLang(lang.code)}
            style={[
              styles.langChip,
              {
                backgroundColor: sttLang === lang.code ? colors.primary : colors.card,
                borderColor: sttLang === lang.code ? colors.primary : colors.cardBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.langChipText,
                { color: sttLang === lang.code ? colors.primaryText : colors.sub },
              ]}
              numberOfLines={1}
            >
              {lang.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Nút mic lớn */}
      <View style={styles.micSection}>
        <Pressable
          onPress={isListening ? stopListening : startListening}
          accessibilityLabel={isListening ? 'Dừng nghe' : 'Bắt đầu nghe'}
        >
          <Animated.View
            style={[
              styles.micButton,
              {
                backgroundColor: isListening ? colors.danger : colors.primary,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Ionicons
              name={isListening ? 'stop' : 'mic'}
              size={42}
              color={isListening ? '#FFFFFF' : colors.primaryText}
            />
          </Animated.View>
        </Pressable>
        <Text style={[styles.micLabel, { color: colors.sub }]}>
          {isListening
            ? 'Đang nghe... nhấn để dừng'
            : 'Nhấn để bắt đầu nói'}
        </Text>
      </View>

      {/* Kết quả nhận dạng */}
      <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.resultHeader}>
          <Text style={[styles.resultTitle, { color: colors.text }]}>Kết quả nhận dạng</Text>
          <View style={styles.resultActions}>
            {(transcript || partialTranscript) ? (
              <>
                <Pressable
                  onPress={() => copyTranscript(transcript || partialTranscript)}
                  hitSlop={8}
                  style={styles.actionBtn}
                >
                  <Ionicons name="copy-outline" size={20} color={colors.primary} />
                </Pressable>
                <Pressable onPress={saveToHistory} hitSlop={8} style={styles.actionBtn}>
                  <Ionicons name="bookmark-outline" size={20} color={colors.primary} />
                </Pressable>
                <Pressable onPress={clearTranscript} hitSlop={8} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.resultBody}>
          {transcript || partialTranscript ? (
            <>
              {transcript ? (
                <Text style={[styles.transcriptText, { color: colors.text }]}>
                  {transcript}
                </Text>
              ) : null}
              {partialTranscript ? (
                <Text style={[styles.partialText, { color: colors.sub }]}>
                  {partialTranscript}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={[styles.placeholderText, { color: colors.sub }]}>
              {isListening
                ? '🎙️ Đang lắng nghe...'
                : 'Kết quả nhận dạng sẽ hiện ở đây'}
            </Text>
          )}
        </View>

        {transcript && (
          <Text style={[styles.wordCount, { color: colors.sub }]}>
            {transcript.trim().split(/\s+/).length} từ • {transcript.length} ký tự
          </Text>
        )}
      </View>

      {/* Lịch sử */}
      {sttHistory.length > 0 && (
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Lịch sử</Text>
            <Pressable onPress={() => setSttHistory([])} hitSlop={8}>
              <Text style={[styles.clearBtn, { color: colors.danger }]}>Xóa</Text>
            </Pressable>
          </View>
          {sttHistory.map((item) => (
            <View key={item.id} style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.historyText, { color: colors.text }]} numberOfLines={2}>
                {item.text}
              </Text>
              <View style={styles.historyMeta}>
                <Text style={[styles.historyTime, { color: colors.sub }]}>
                  {item.lang} • {item.time}
                </Text>
                <Pressable onPress={() => copyTranscript(item.text)} hitSlop={6}>
                  <Ionicons name="copy-outline" size={16} color={colors.primary} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  );

  // ============================================================
  // RENDER PHẦN TTS
  // ============================================================
  const renderTtsTab = () => (
    <>
      {/* Chọn ngôn ngữ đọc */}
      <View style={styles.langRow}>
        {LANGUAGES.map((lang) => (
          <Pressable
            key={lang.code}
            onPress={() => {
              setSttLang(lang.code);
              setTtsLang(lang.code);
            }}
            style={[
              styles.langChip,
              {
                backgroundColor: ttsLang === lang.code ? colors.primary : colors.card,
                borderColor: ttsLang === lang.code ? colors.primary : colors.cardBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.langChipText,
                { color: ttsLang === lang.code ? colors.primaryText : colors.sub },
              ]}
              numberOfLines={1}
            >
              {lang.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Ô nhập văn bản */}
      <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Văn bản cần đọc</Text>
        <TextInput
          style={[styles.ttsInput, { color: colors.text, borderColor: colors.border }]}
          value={ttsText}
          onChangeText={setTtsText}
          placeholder="Nhập hoặc dán văn bản vào đây..."
          placeholderTextColor={colors.sub}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          editable={!isSpeaking}
          autoCapitalize="sentences"
          autoCorrect={false}
          accessibilityLabel="Văn bản cần đọc"
        />
        <View style={styles.inputFooter}>
          <Text style={[styles.charCount, { color: colors.sub }]}>
            {ttsText.length} ký tự
          </Text>
          {ttsText.length > 0 && (
            <Pressable
              onPress={async () => {
                const clip = await Clipboard.getStringAsync();
                if (clip) setTtsText(clip);
              }}
              hitSlop={8}
            >
              <Text style={[styles.pasteBtn, { color: colors.primary }]}>Dán</Text>
            </Pressable>
          )}
          {ttsText.length > 0 && (
            <Pressable onPress={() => { stopSpeaking(); setTtsText(''); }} hitSlop={8}>
              <Text style={[styles.clearBtn, { color: colors.danger }]}>Xóa</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Cài đặt tốc độ & pitch */}
      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>Cài đặt giọng đọc</Text>

        {/* Tốc độ */}
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.sub }]}>Tốc độ</Text>
          <View style={styles.settingSteps}>
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((val) => (
              <Pressable
                key={val}
                onPress={() => setSpeechRate(val)}
                style={[
                  styles.stepBtn,
                  {
                    backgroundColor: speechRate === val ? colors.primary : colors.cardElevated,
                    borderColor: speechRate === val ? colors.primary : colors.cardBorder,
                  },
                ]}
              >
                <Text style={[
                  styles.stepBtnText,
                  { color: speechRate === val ? colors.primaryText : colors.sub },
                ]}>
                  {val}x
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Cao độ */}
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.sub }]}>Cao độ</Text>
          <View style={styles.settingSteps}>
            {[0.5, 0.75, 1.0, 1.25, 1.5].map((val) => (
              <Pressable
                key={val}
                onPress={() => setSpeechPitch(val)}
                style={[
                  styles.stepBtn,
                  {
                    backgroundColor: speechPitch === val ? colors.primary : colors.cardElevated,
                    borderColor: speechPitch === val ? colors.primary : colors.cardBorder,
                  },
                ]}
              >
                <Text style={[
                  styles.stepBtnText,
                  { color: speechPitch === val ? colors.primaryText : colors.sub },
                ]}>
                  {val}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Nút đọc */}
      <Pressable
        onPress={handleSpeak}
        disabled={!ttsText.trim()}
        style={[
          styles.speakBtn,
          {
            backgroundColor: !ttsText.trim()
              ? colors.cardElevated
              : isSpeaking
                ? colors.danger
                : colors.primary,
            opacity: !ttsText.trim() ? 0.5 : 1,
          },
        ]}
      >
        <Ionicons
          name={isSpeaking ? 'stop-circle' : 'volume-high'}
          size={26}
          color={!ttsText.trim() ? colors.sub : isSpeaking ? '#FFFFFF' : colors.primaryText}
        />
        <Text style={[
          styles.speakBtnText,
          { color: !ttsText.trim() ? colors.sub : isSpeaking ? '#FFFFFF' : colors.primaryText },
        ]}>
          {isSpeaking ? 'Dừng đọc' : 'Đọc văn bản'}
        </Text>
      </Pressable>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Giọng nói ↔ Văn bản"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <FlatList
        data={[]}
        renderItem={null}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            {/* Banner giới thiệu */}
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={[styles.heroIcon, { backgroundColor: '#7C3AED' }]}>
                <Ionicons name="mic" size={30} color="#FFFFFF" />
              </View>
              <Text style={[styles.heroTitle, { color: colors.text }]}>
                Chuyển đổi Giọng nói ↔ Văn bản
              </Text>
              <Text style={[styles.heroDesc, { color: colors.sub }]}>
                Nhận dạng giọng nói thành chữ viết và ngược lại, hỗ trợ nhiều ngôn ngữ, lưu ghi chú tức thì.
              </Text>
            </View>

            {/* Tab chuyển đổi */}
            <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Pressable
                onPress={() => { stopListening(); stopSpeaking(); setActiveTab(TAB_STT); }}
                style={[
                  styles.tab,
                  {
                    backgroundColor: activeTab === TAB_STT ? colors.primary : 'transparent',
                    borderRadius: 12,
                  },
                ]}
              >
                <Ionicons name="mic" size={18} color={activeTab === TAB_STT ? colors.primaryText : colors.sub} />
                <Text style={[styles.tabText, { color: activeTab === TAB_STT ? colors.primaryText : colors.sub }]}>
                  Giọng nói → Chữ
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { stopListening(); stopSpeaking(); setActiveTab(TAB_TTS); }}
                style={[
                  styles.tab,
                  {
                    backgroundColor: activeTab === TAB_TTS ? colors.primary : 'transparent',
                    borderRadius: 12,
                  },
                ]}
              >
                <Ionicons name="volume-high" size={18} color={activeTab === TAB_TTS ? colors.primaryText : colors.sub} />
                <Text style={[styles.tabText, { color: activeTab === TAB_TTS ? colors.primaryText : colors.sub }]}>
                  Chữ → Giọng nói
                </Text>
              </Pressable>
            </View>

            {/* Nội dung theo tab */}
            {activeTab === TAB_STT ? renderSttTab() : renderTtsTab()}

            <View style={{ height: 100 }} />
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Hero
  heroCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 14,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  heroDesc: { fontSize: 13, textAlign: 'center', lineHeight: 19, fontWeight: '500' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    marginBottom: 16,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  tabText: { fontSize: 13, fontWeight: '700' },

  // Language chips
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  langChipText: { fontSize: 12, fontWeight: '700' },

  // Mic button
  micSection: { alignItems: 'center', marginVertical: 20 },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  micLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center' },

  // Result card
  resultCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    minHeight: 120,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultTitle: { fontSize: 15, fontWeight: '700' },
  resultActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 4 },
  resultBody: { minHeight: 60 },
  transcriptText: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  partialText: { fontSize: 15, lineHeight: 22, fontStyle: 'italic', marginTop: 4 },
  placeholderText: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 12 },
  wordCount: { fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'right' },

  // History
  historySection: { marginBottom: 16 },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  clearBtn: { fontSize: 14, fontWeight: '700' },
  historyItem: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  historyText: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 6 },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTime: { fontSize: 11, fontWeight: '600' },

  // TTS input
  inputCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  inputLabel: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  ttsInput: {
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 130,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  charCount: { fontSize: 12, fontWeight: '600', flex: 1 },
  pasteBtn: { fontSize: 14, fontWeight: '700' },

  // Settings card
  settingsCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  settingTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  settingRow: { marginBottom: 12 },
  settingLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  settingSteps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  stepBtnText: { fontSize: 13, fontWeight: '700' },

  // Speak button
  speakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 10,
  },
  speakBtnText: { fontSize: 17, fontWeight: '800' },
});
