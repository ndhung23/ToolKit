// src/features/voice-text/VoiceTextScreen.js
// Màn hình chuyển đổi giọng nói <-> văn bản (2 chiều)
// Hỗ trợ chọn giọng đọc AI đa dạng phong cách như Vbee (>= 8 giọng Việt Nam, 6 giọng tiếng Anh)

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  FlatList,
  Animated,
  ActivityIndicator,
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

// Danh sách giọng đọc AI Tiếng Việt phong cách Vbee (8 giọng đa dạng vùng miền & giới tính)
const VIETNAMESE_VOICES = [
  {
    id: 'vn-mai',
    name: 'Hà Tiểu Mai',
    gender: 'female',
    genderLabel: 'Nữ',
    region: 'Miền Bắc',
    style: 'Truyền cảm • Đọc truyện',
    avatar: '👧',
    sample: 'Xin chào! Tôi là Hà Tiểu Mai, giọng đọc nữ miền Bắc truyền cảm và dịu dàng.',
    pitch: 1.25,
    rate: 1.0,
    badge: 'Phổ biến',
  },
  {
    id: 'vn-dung',
    name: 'Mạnh Dũng',
    gender: 'male',
    genderLabel: 'Nam',
    region: 'Miền Bắc',
    style: 'Trầm ấm • Thuyết minh',
    avatar: '👨',
    sample: 'Xin chào! Tôi là Mạnh Dũng, giọng đọc nam miền Bắc trầm ấm và truyền cảm hứng.',
    pitch: 0.8,
    rate: 0.95,
    badge: 'Yêu thích',
  },
  {
    id: 'vn-nhi',
    name: 'Thảo Nhi',
    gender: 'female',
    genderLabel: 'Nữ',
    region: 'Miền Nam',
    style: 'Ngọt ngào • Review sản phẩm',
    avatar: '👩',
    sample: 'Xin chào mọi người! Em là Thảo Nhi, giọng nữ miền Nam ngọt ngào và duyên dáng nè.',
    pitch: 1.2,
    rate: 1.05,
    badge: 'Reviewer',
  },
  {
    id: 'vn-hoang',
    name: 'Minh Hoàng',
    gender: 'male',
    genderLabel: 'Nam',
    region: 'Miền Nam',
    style: 'Hiện đại • Năng động • Vlog',
    avatar: '🧑',
    sample: 'Chào các bạn! Mình là Minh Hoàng, giọng nam miền Nam năng động, tự tin.',
    pitch: 0.88,
    rate: 1.08,
    badge: 'Vlog',
  },
  {
    id: 'vn-truc',
    name: 'Thanh Trúc',
    gender: 'female',
    genderLabel: 'Nữ',
    region: 'Miền Trung',
    style: 'Nhẹ nhàng • Sâu lắng • Thơ ca',
    avatar: '🧕',
    sample: 'Kính chào quý thính giả! Em là Thanh Trúc, giọng nữ Huế sâu lắng và tinh tế.',
    pitch: 1.15,
    rate: 0.92,
    badge: 'Đặc sắc',
  },
  {
    id: 'vn-nam',
    name: 'Bảo Nam',
    gender: 'male',
    genderLabel: 'Nam',
    region: 'Miền Bắc',
    style: 'Sôi nổi • Trẻ trung • TikTok',
    avatar: '🧒',
    sample: 'Helo anh em! Bảo Nam đây, giọng nam trẻ cực kỳ sôi nổi cho video ngắn nhé!',
    pitch: 0.96,
    rate: 1.2,
    badge: 'TikTok',
  },
  {
    id: 'vn-phuong',
    name: 'Mai Phương',
    gender: 'female',
    genderLabel: 'Nữ',
    region: 'Miền Bắc',
    style: 'MC Tin tức • Thời sự chuẩn mực',
    avatar: '👩‍💼',
    sample: 'Kính chào quý vị khán giả! Tôi là Mai Phương, biên tập viên bản tin hôm nay.',
    pitch: 1.1,
    rate: 1.0,
    badge: 'MC Tin tức',
  },
  {
    id: 'vn-tuan',
    name: 'Quốc Tuấn',
    gender: 'male',
    genderLabel: 'Nam',
    region: 'Miền Nam',
    style: 'Hùng hồn • Sách nói • Podcast',
    avatar: '👨‍💼',
    sample: 'Xin chào thính giả! Tôi là Quốc Tuấn, chuyên đọc sách nói kinh điển và triết học.',
    pitch: 0.75,
    rate: 0.9,
    badge: 'Sách nói',
  },
];

// Danh sách giọng đọc AI Tiếng Anh (6 giọng)
const ENGLISH_VOICES = [
  {
    id: 'en-jenny',
    name: 'Jenny',
    gender: 'female',
    genderLabel: 'Female',
    region: 'US English',
    style: 'Natural • Friendly • Story',
    avatar: '👩',
    sample: 'Hello there! I am Jenny, a warm and friendly American English voice.',
    pitch: 1.18,
    rate: 1.0,
    badge: 'Popular',
  },
  {
    id: 'en-guy',
    name: 'Guy',
    gender: 'male',
    genderLabel: 'Male',
    region: 'US English',
    style: 'Deep • Authoritative • News',
    avatar: '👨',
    sample: 'Good day! I am Guy, a deep and professional voice for your broadcast.',
    pitch: 0.82,
    rate: 0.98,
    badge: 'News',
  },
  {
    id: 'en-aria',
    name: 'Aria',
    gender: 'female',
    genderLabel: 'Female',
    region: 'US English',
    style: 'Expressive • Vibrant • TikTok',
    avatar: '👧',
    sample: 'Hey everyone! This is Aria, bringing lively energy to your videos!',
    pitch: 1.28,
    rate: 1.1,
    badge: 'Vibrant',
  },
  {
    id: 'en-davis',
    name: 'Davis',
    gender: 'male',
    genderLabel: 'Male',
    region: 'US English',
    style: 'Casual • Warm • Podcast',
    avatar: '🧑',
    sample: 'Welcome back friends! Davis here, ready for your next podcast episode.',
    pitch: 0.88,
    rate: 1.02,
    badge: 'Podcast',
  },
  {
    id: 'en-sonia',
    name: 'Sonia',
    gender: 'female',
    genderLabel: 'Female',
    region: 'UK English',
    style: 'British • Elegant • Audiobook',
    avatar: '👱‍♀️',
    sample: 'Greetings! I am Sonia, delivering elegant British English narration.',
    pitch: 1.15,
    rate: 0.95,
    badge: 'British',
  },
  {
    id: 'en-ryan',
    name: 'Ryan',
    gender: 'male',
    genderLabel: 'Male',
    region: 'UK English',
    style: 'British • Confident • Docu',
    avatar: '🧔',
    sample: 'Hello! I am Ryan, your narrator for world class documentary films.',
    pitch: 0.85,
    rate: 0.95,
    badge: 'Narrator',
  },
];

// Giọng quốc tế tổng hợp (Nhật, Hàn, Trung, Pháp - tối thiểu 6 giọng)
const OTHER_VOICES = [
  {
    id: 'intl-sakura',
    name: 'Sakura (さくら)',
    gender: 'female',
    genderLabel: 'Female',
    region: 'Japanese',
    style: 'Dịu dàng • Anime • Truyện tranh',
    avatar: '🌸',
    sample: 'こんにちは！さくらです。よろしくお願いいたします。',
    pitch: 1.22,
    rate: 1.0,
    badge: 'Tokyo',
  },
  {
    id: 'intl-kenji',
    name: 'Kenji (健二)',
    gender: 'male',
    genderLabel: 'Male',
    region: 'Japanese',
    style: 'Trầm ấm • Tin tức Nhật Bản',
    avatar: '🏯',
    sample: 'こんにちは！健二です。ニュースをお伝えします。',
    pitch: 0.85,
    rate: 0.98,
    badge: 'News',
  },
  {
    id: 'intl-jisoo',
    name: 'Jisoo (지수)',
    gender: 'female',
    genderLabel: 'Female',
    region: 'Korean',
    style: 'Trong trẻo • K-Drama',
    avatar: '🎀',
    sample: '안녕하세요! 지수입니다. 만나서 반가워요.',
    pitch: 1.2,
    rate: 1.02,
    badge: 'Seoul',
  },
  {
    id: 'intl-minho',
    name: 'Minho (민호)',
    gender: 'male',
    genderLabel: 'Male',
    region: 'Korean',
    style: 'Ấm áp • Lãng mạn',
    avatar: '🇰🇷',
    sample: '안녕하세요! 민호입니다. 좋은 하루 보내세요.',
    pitch: 0.86,
    rate: 1.0,
    badge: 'Vlog',
  },
  {
    id: 'intl-xiaomei',
    name: 'Xiaomei (小美)',
    gender: 'female',
    genderLabel: 'Female',
    region: 'Chinese',
    style: 'Chuẩn phổ thông • Thân thiện',
    avatar: '🏮',
    sample: '你好！我是小美，很高兴为你朗读文本。',
    pitch: 1.18,
    rate: 1.0,
    badge: 'Mandarin',
  },
  {
    id: 'intl-charlotte',
    name: 'Charlotte',
    gender: 'female',
    genderLabel: 'Female',
    region: 'French',
    style: 'Thơ mộng • Sang trọng',
    avatar: '🥐',
    sample: 'Bonjour! Je suis Charlotte, ravie de vous lire ce texte.',
    pitch: 1.15,
    rate: 0.98,
    badge: 'Paris',
  },
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

  // --- Chọn giọng đọc kiểu Vbee ---
  const [selectedVoiceId, setSelectedVoiceId] = useState('vn-mai');
  const [previewingVoiceId, setPreviewingVoiceId] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all'); // 'all', 'female', 'male', 'Miền Bắc', 'Miền Nam', 'Miền Trung'
  const [systemVoices, setSystemVoices] = useState([]);

  // Animation cho nút mic
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const pulseLoop = useRef(null);

  // Lấy danh sách giọng AI phù hợp theo ngôn ngữ hiện tại
  const currentVoiceList = useMemo(() => {
    if (ttsLang === 'vi-VN') return VIETNAMESE_VOICES;
    if (ttsLang === 'en-US') return ENGLISH_VOICES;
    return OTHER_VOICES;
  }, [ttsLang]);

  // Lọc theo bộ lọc danh mục (Tất cả, Nam, Nữ, Vùng miền)
  const filteredVoices = useMemo(() => {
    if (filterCategory === 'all') return currentVoiceList;
    if (filterCategory === 'female' || filterCategory === 'male') {
      return currentVoiceList.filter((v) => v.gender === filterCategory);
    }
    return currentVoiceList.filter((v) => v.region === filterCategory);
  }, [currentVoiceList, filterCategory]);

  // Giọng đang chọn hiện tại
  const currentVoice = useMemo(() => {
    return currentVoiceList.find((v) => v.id === selectedVoiceId) || currentVoiceList[0];
  }, [currentVoiceList, selectedVoiceId]);

  // Request quyền mic
  const requestSttPermission = useCallback(async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setHasSttPermission(result.granted);
    } catch {
      setHasSttPermission(false);
    }
  }, []);

  // Xử lý khi người dùng đổi ngôn ngữ đọc
  const handleSelectTtsLang = (langCode) => {
    setSttLang(langCode);
    setTtsLang(langCode);
    if (langCode === 'vi-VN') setSelectedVoiceId('vn-mai');
    else if (langCode === 'en-US') setSelectedVoiceId('en-jenny');
    else setSelectedVoiceId('intl-sakura');
    setFilterCategory('all');
  };

  // Yêu cầu quyền mic & load voice hệ thống khi mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (isMounted) setHasSttPermission(result.granted);
        const voices = await Speech.getAvailableVoicesAsync();
        if (isMounted) setSystemVoices(voices || []);
      } catch {
        if (isMounted) {
          setHasSttPermission(false);
          setSystemVoices([]);
        }
      }
    })();
    return () => {
      isMounted = false;
      ExpoSpeechRecognitionModule.abort();
      Speech.stop();
    };
  }, []);

  // Đăng ký speech recognition events ở top-level (Rules of Hooks)
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

  // Animation pulse khi đang nghe STT
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

  // ============================================================
  // STT: BẮT ĐẦU NGHE
  // ============================================================
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
        androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'free_form' },
      });
    } catch (err) {
      setIsListening(false);
      Alert.alert('Lỗi', err.message || 'Không thể khởi động nhận dạng giọng nói.');
    }
  }, [hasSttPermission, sttLang, requestSttPermission]);

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

  const copyTranscript = useCallback(async (text) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Đã sao chép ✅', 'Văn bản đã được sao chép vào clipboard.');
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setPartialTranscript('');
  }, []);

  // Tìm giọng hệ thống khớp với ngôn ngữ và giới tính nếu có
  const findMatchingSystemVoice = useCallback((lang, gender) => {
    if (!systemVoices.length) return null;
    const prefix = lang.split('-')[0].toLowerCase();
    const langVoices = systemVoices.filter((v) => {
      const vl = (v.language || '').toLowerCase();
      return vl.startsWith(prefix) || vl === lang.toLowerCase();
    });
    if (!langVoices.length) return null;

    // Thử khớp theo gender nếu tên voice có chứa hint
    if (gender) {
      const matchGender = langVoices.find((v) => {
        const idLower = (v.identifier || '').toLowerCase();
        const nameLower = (v.name || '').toLowerCase();
        if (gender === 'female') return idLower.includes('female') || nameLower.includes('female') || idLower.includes('woman');
        if (gender === 'male') return idLower.includes('male') || nameLower.includes('male') || idLower.includes('man');
        return false;
      });
      if (matchGender) return matchGender.identifier;
    }
    return langVoices[0].identifier;
  }, [systemVoices]);

  // ============================================================
  // TTS: NGHE THỬ GIỌNG ĐỌC MẪU
  // ============================================================
  const handlePreviewVoice = useCallback(async (voice) => {
    try {
      await Speech.stop();
      if (previewingVoiceId === voice.id) {
        setPreviewingVoiceId(null);
        return;
      }
      setPreviewingVoiceId(voice.id);
      setIsSpeaking(false);

      const sysVoice = findMatchingSystemVoice(ttsLang, voice.gender);
      const options = {
        language: ttsLang,
        pitch: voice.pitch,
        rate: voice.rate,
        onDone: () => setPreviewingVoiceId(null),
        onStopped: () => setPreviewingVoiceId(null),
        onError: () => setPreviewingVoiceId(null),
      };
      if (sysVoice) options.voice = sysVoice;

      Speech.speak(voice.sample, options);
    } catch {
      setPreviewingVoiceId(null);
    }
  }, [previewingVoiceId, ttsLang, findMatchingSystemVoice]);

  // ============================================================
  // TTS: ĐỌC VĂN BẢN ĐÃ NHẬP
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
    await Speech.stop();
    setPreviewingVoiceId(null);
    setIsSpeaking(true);

    const voice = currentVoice || VIETNAMESE_VOICES[0];
    const sysVoice = findMatchingSystemVoice(ttsLang, voice.gender);

    // Tính toán pitch & rate kết hợp giữa preset của nhân vật và tinh chỉnh người dùng
    const finalPitch = Math.max(0.5, Math.min(2.0, (voice.pitch || 1.0) * speechPitch));
    const finalRate = Math.max(0.5, Math.min(2.0, (voice.rate || 1.0) * speechRate));

    const options = {
      language: ttsLang,
      rate: finalRate,
      pitch: finalPitch,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => {
        setIsSpeaking(false);
        Alert.alert('Lỗi đọc', 'Không thể đọc văn bản này. Vui lòng kiểm tra lại thiết bị.');
      },
    };

    if (sysVoice) options.voice = sysVoice;

    Speech.speak(text, options);
  }, [ttsText, isSpeaking, currentVoice, findMatchingSystemVoice, ttsLang, speechPitch, speechRate]);

  const stopSpeaking = useCallback(async () => {
    await Speech.stop();
    setIsSpeaking(false);
    setPreviewingVoiceId(null);
  }, []);

  // ============================================================
  // RENDER STT TAB (Giọng nói -> Văn bản)
  // ============================================================
  const renderSttTab = () => (
    <>
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
              style={[styles.langChipText, { color: sttLang === lang.code ? colors.primaryText : colors.sub }]}
              numberOfLines={1}
            >
              {lang.label}
            </Text>
          </Pressable>
        ))}
      </View>

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
          {isListening ? 'Đang nghe... nhấn để dừng' : 'Nhấn để bắt đầu nói'}
        </Text>
      </View>

      <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.resultHeader}>
          <Text style={[styles.resultTitle, { color: colors.text }]}>Kết quả nhận dạng</Text>
          <View style={styles.resultActions}>
            {transcript || partialTranscript ? (
              <>
                <Pressable onPress={() => copyTranscript(transcript || partialTranscript)} hitSlop={8} style={styles.actionBtn}>
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
              {transcript ? <Text style={[styles.transcriptText, { color: colors.text }]}>{transcript}</Text> : null}
              {partialTranscript ? <Text style={[styles.partialText, { color: colors.sub }]}>{partialTranscript}</Text> : null}
            </>
          ) : (
            <Text style={[styles.placeholderText, { color: colors.sub }]}>
              {isListening ? '🎙️ Đang lắng nghe...' : 'Kết quả nhận dạng sẽ hiện ở đây'}
            </Text>
          )}
        </View>
        {transcript ? (
          <Text style={[styles.wordCount, { color: colors.sub }]}>
            {transcript.trim().split(/\s+/).length} từ • {transcript.length} ký tự
          </Text>
        ) : null}
      </View>

      {sttHistory.length > 0 && (
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Lịch sử</Text>
            <Pressable onPress={() => setSttHistory([])} hitSlop={8}>
              <Text style={[styles.clearBtnText, { color: colors.danger }]}>Xóa</Text>
            </Pressable>
          </View>
          {sttHistory.map((item) => (
            <View key={item.id} style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.historyText, { color: colors.text }]} numberOfLines={2}>{item.text}</Text>
              <View style={styles.historyMeta}>
                <Text style={[styles.historyTime, { color: colors.sub }]}>{item.lang} • {item.time}</Text>
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
  // RENDER TTS TAB (Văn bản -> Giọng nói kiểu Vbee với >= 6 giọng)
  // ============================================================
  const renderTtsTab = () => (
    <>
      {/* Chọn ngôn ngữ đọc */}
      <View style={styles.langRow}>
        {LANGUAGES.map((lang) => (
          <Pressable
            key={lang.code}
            onPress={() => handleSelectTtsLang(lang.code)}
            style={[
              styles.langChip,
              {
                backgroundColor: ttsLang === lang.code ? colors.primary : colors.card,
                borderColor: ttsLang === lang.code ? colors.primary : colors.cardBorder,
              },
            ]}
          >
            <Text
              style={[styles.langChipText, { color: ttsLang === lang.code ? colors.primaryText : colors.sub }]}
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
          placeholder="Nhập hoặc dán văn bản vào đây để chuyển thành giọng nói..."
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
          <Text style={[styles.charCount, { color: colors.sub }]}>{ttsText.length} ký tự</Text>
          {ttsText.length === 0 && (
            <Pressable
              onPress={async () => {
                const clip = await Clipboard.getStringAsync();
                if (clip) setTtsText(clip);
              }}
              hitSlop={8}
            >
              <Text style={[styles.actionText, { color: colors.primary }]}>Dán</Text>
            </Pressable>
          )}
          {ttsText.length > 0 && (
            <Pressable onPress={() => { stopSpeaking(); setTtsText(''); }} hitSlop={8}>
              <Text style={[styles.actionText, { color: colors.danger }]}>Xóa</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ===== DANH SÁCH GIỌNG ĐỌC AI KIỂU VBEE (>= 6 - 8 LỰA CHỌN) ===== */}
      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.settingTitleRow}>
          <Ionicons name="people" size={20} color="#7C3AED" />
          <Text style={[styles.settingTitle, { color: colors.text }]}>
            Chọn giọng đọc AI ({filteredVoices.length} giọng)
          </Text>
          <View style={styles.badgeVbee}>
            <Text style={styles.badgeVbeeText}>Vbee AI</Text>
          </View>
        </View>

        {/* Bộ lọc danh mục kiểu Vbee */}
        {ttsLang === 'vi-VN' && (
          <View style={styles.filterRow}>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'female', label: 'Nữ 👩' },
              { id: 'male', label: 'Nam 👨' },
              { id: 'Miền Bắc', label: 'Miền Bắc' },
              { id: 'Miền Nam', label: 'Miền Nam' },
              { id: 'Miền Trung', label: 'Miền Trung' },
            ].map((f) => {
              const active = filterCategory === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilterCategory(f.id)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? '#7C3AED' : colors.cardElevated,
                      borderColor: active ? '#7C3AED' : colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: active ? '#FFFFFF' : colors.sub }]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Danh sách thẻ giọng đọc */}
        <View style={styles.voiceListContainer}>
          {filteredVoices.map((voice) => {
            const isSelected = selectedVoiceId === voice.id;
            const isPreviewing = previewingVoiceId === voice.id;

            return (
              <Pressable
                key={voice.id}
                onPress={() => setSelectedVoiceId(voice.id)}
                style={[
                  styles.voiceCard,
                  {
                    backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.12)' : colors.cardElevated,
                    borderColor: isSelected ? '#7C3AED' : colors.cardBorder,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                {/* Avatar & Info */}
                <View style={styles.voiceCardTop}>
                  <View style={styles.voiceAvatarBox}>
                    <Text style={styles.voiceAvatarEmoji}>{voice.avatar}</Text>
                  </View>
                  <View style={styles.voiceInfoBox}>
                    <View style={styles.voiceNameRow}>
                      <Text style={[styles.voiceNameText, { color: colors.text }]}>{voice.name}</Text>
                      {voice.badge ? (
                        <View style={styles.tagBadge}>
                          <Text style={styles.tagBadgeText}>{voice.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.voiceStyleText, { color: colors.sub }]}>{voice.style}</Text>
                    <View style={styles.voiceMetaRow}>
                      <Text style={[styles.voiceMetaTag, { color: colors.sub }]}>{voice.genderLabel}</Text>
                      <Text style={[styles.voiceMetaDot, { color: colors.sub }]}>•</Text>
                      <Text style={[styles.voiceMetaTag, { color: colors.sub }]}>{voice.region}</Text>
                    </View>
                  </View>

                  {/* Nút Nghe thử kiểu Vbee */}
                  <Pressable
                    onPress={() => handlePreviewVoice(voice)}
                    hitSlop={8}
                    style={[
                      styles.previewBtn,
                      {
                        backgroundColor: isPreviewing ? colors.danger : '#7C3AED',
                      },
                    ]}
                  >
                    <Ionicons
                      name={isPreviewing ? 'stop' : 'volume-medium'}
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.previewBtnText}>
                      {isPreviewing ? 'Dừng' : 'Nghe thử'}
                    </Text>
                  </Pressable>
                </View>

                {/* Chọn radio button */}
                <View style={styles.voiceCardBottom}>
                  <View style={styles.selectRadioRow}>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isSelected ? '#7C3AED' : colors.sub}
                    />
                    <Text
                      style={[
                        styles.selectRadioText,
                        { color: isSelected ? '#7C3AED' : colors.sub, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {isSelected ? 'Đang chọn giọng này' : 'Nhấn để chọn'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Cài đặt tốc độ & pitch tinh chỉnh */}
      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.settingTitleRow}>
          <Ionicons name="options-outline" size={20} color={colors.primary} />
          <Text style={[styles.settingTitle, { color: colors.text }]}>Tinh chỉnh nâng cao</Text>
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.sub }]}>
            Tốc độ đọc · <Text style={{ color: colors.primary, fontWeight: '700' }}>{speechRate}x</Text>
          </Text>
          <View style={styles.settingSteps}>
            {[0.75, 1.0, 1.25, 1.5].map((val) => (
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
                <Text style={[styles.stepBtnText, { color: speechRate === val ? colors.primaryText : colors.sub }]}>
                  {val}x
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.sub }]}>
            Cao độ (Pitch) · <Text style={{ color: colors.primary, fontWeight: '700' }}>{speechPitch}</Text>
          </Text>
          <View style={styles.settingSteps}>
            {[0.8, 1.0, 1.2].map((val) => (
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
                <Text style={[styles.stepBtnText, { color: speechPitch === val ? colors.primaryText : colors.sub }]}>
                  {val}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Nút đọc toàn bộ */}
      <Pressable
        onPress={handleSpeak}
        disabled={!ttsText.trim()}
        style={[
          styles.speakBtn,
          {
            backgroundColor: !ttsText.trim() ? colors.cardElevated : isSpeaking ? colors.danger : '#7C3AED',
            opacity: !ttsText.trim() ? 0.5 : 1,
          },
        ]}
      >
        <Ionicons
          name={isSpeaking ? 'stop-circle' : 'volume-high'}
          size={26}
          color={!ttsText.trim() ? colors.sub : '#FFFFFF'}
        />
        <Text style={[styles.speakBtnText, { color: !ttsText.trim() ? colors.sub : '#FFFFFF' }]}>
          {isSpeaking ? 'Dừng đọc' : `Đọc văn bản (${currentVoice?.name || 'Giọng AI'})`}
        </Text>
        {isSpeaking && (
          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 4 }} />
        )}
      </Pressable>

      {/* Thông tin giọng đọc đang áp dụng */}
      {currentVoice && !isSpeaking && (
        <View style={[styles.activeVoiceBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={{ fontSize: 18 }}>{currentVoice.avatar}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.activeVoiceTitle, { color: colors.text }]}>
              Giọng: {currentVoice.name} ({currentVoice.region} - {currentVoice.genderLabel})
            </Text>
            <Text style={[styles.activeVoiceSub, { color: colors.sub }]}>
              Phong cách: {currentVoice.style}
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        </View>
      )}
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
                Nhận dạng giọng nói thành văn bản & Đọc văn bản với kho giọng AI đa dạng (Bắc - Trung - Nam) như Vbee.
              </Text>
            </View>

            {/* Tab chuyển đổi */}
            <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Pressable
                onPress={() => { stopListening(); stopSpeaking(); setActiveTab(TAB_STT); }}
                style={[
                  styles.tab,
                  { backgroundColor: activeTab === TAB_STT ? '#7C3AED' : 'transparent', borderRadius: 12 },
                ]}
              >
                <Ionicons name="mic" size={18} color={activeTab === TAB_STT ? '#FFFFFF' : colors.sub} />
                <Text style={[styles.tabText, { color: activeTab === TAB_STT ? '#FFFFFF' : colors.sub }]}>
                  Giọng nói → Chữ
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { stopListening(); stopSpeaking(); setActiveTab(TAB_TTS); }}
                style={[
                  styles.tab,
                  { backgroundColor: activeTab === TAB_TTS ? '#7C3AED' : 'transparent', borderRadius: 12 },
                ]}
              >
                <Ionicons name="volume-high" size={18} color={activeTab === TAB_TTS ? '#FFFFFF' : colors.sub} />
                <Text style={[styles.tabText, { color: activeTab === TAB_TTS ? '#FFFFFF' : colors.sub }]}>
                  Chữ → Giọng nói
                </Text>
              </Pressable>
            </View>

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

  heroCard: {
    borderRadius: 20, padding: 20, alignItems: 'center',
    borderWidth: 1, marginBottom: 14,
  },
  heroIcon: {
    width: 60, height: 60, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  heroDesc: { fontSize: 13, textAlign: 'center', lineHeight: 19, fontWeight: '500' },

  tabBar: {
    flexDirection: 'row', borderRadius: 16, padding: 6,
    borderWidth: 1, marginBottom: 16, gap: 6,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 10, gap: 6,
  },
  tabText: { fontSize: 13, fontWeight: '700' },

  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  langChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  langChipText: { fontSize: 12, fontWeight: '700' },

  micSection: { alignItems: 'center', marginVertical: 20 },
  micButton: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  micLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center' },

  resultCard: {
    borderRadius: 18, padding: 16, borderWidth: 1,
    marginBottom: 16, minHeight: 120,
  },
  resultHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  resultTitle: { fontSize: 15, fontWeight: '700' },
  resultActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 4 },
  resultBody: { minHeight: 60 },
  transcriptText: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  partialText: { fontSize: 15, lineHeight: 22, fontStyle: 'italic', marginTop: 4 },
  placeholderText: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 12 },
  wordCount: { fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'right' },

  historySection: { marginBottom: 16 },
  historyHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  clearBtnText: { fontSize: 14, fontWeight: '700' },
  historyItem: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 8 },
  historyText: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 6 },
  historyMeta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  historyTime: { fontSize: 11, fontWeight: '600' },

  inputCard: { borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 14 },
  inputLabel: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  ttsInput: {
    fontSize: 16, lineHeight: 24, borderWidth: 1,
    borderRadius: 12, padding: 12, minHeight: 130,
  },
  inputFooter: {
    flexDirection: 'row', justifyContent: 'flex-end',
    alignItems: 'center', marginTop: 8, gap: 16,
  },
  charCount: { fontSize: 12, fontWeight: '600', flex: 1 },
  actionText: { fontSize: 14, fontWeight: '700' },

  // Vbee Voice Selection Styles
  settingsCard: { borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 14 },
  settingTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  settingTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  badgeVbee: {
    backgroundColor: '#7C3AED', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  badgeVbeeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  filterRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
  },
  filterChipText: { fontSize: 11, fontWeight: '700' },

  voiceListContainer: { gap: 10 },
  voiceCard: {
    borderRadius: 14, padding: 12,
  },
  voiceCardTop: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  voiceAvatarBox: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(124,58,237,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceAvatarEmoji: { fontSize: 24 },
  voiceInfoBox: { flex: 1 },
  voiceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  voiceNameText: { fontSize: 15, fontWeight: '800' },
  tagBadge: {
    backgroundColor: '#FFD000', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  tagBadgeText: { fontSize: 10, fontWeight: '800', color: '#121214' },
  voiceStyleText: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  voiceMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  voiceMetaTag: { fontSize: 11, fontWeight: '600' },
  voiceMetaDot: { fontSize: 11 },

  previewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
  },
  previewBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  voiceCardBottom: {
    marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(128,128,128,0.2)',
  },
  selectRadioRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectRadioText: { fontSize: 12 },

  // Cài đặt nâng cao
  settingRow: { marginBottom: 12 },
  settingLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  settingSteps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  stepBtnText: { fontSize: 13, fontWeight: '700' },

  speakBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16, marginBottom: 10, gap: 10,
  },
  speakBtnText: { fontSize: 16, fontWeight: '800' },

  activeVoiceBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8,
  },
  activeVoiceTitle: { fontSize: 13, fontWeight: '700' },
  activeVoiceSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
});
