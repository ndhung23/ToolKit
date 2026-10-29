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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';
import {
  polishTranscriptWithAi,
  summarizeTranscriptWithAi,
  rewriteTextToneWithAi,
  synthesizeSpeechWithGemini,
} from '../../services/geminiService';

// An toàn trên Expo Go (tránh crash khi thiếu native module ExpoSpeechRecognition)
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = () => {};

try {
  const speechRec = require('expo-speech-recognition');
  if (speechRec) {
    ExpoSpeechRecognitionModule = speechRec.ExpoSpeechRecognitionModule || null;
    useSpeechRecognitionEvent = speechRec.useSpeechRecognitionEvent || (() => {});
  }
} catch {
  // Module native không có sẵn trong Expo Go tiêu chuẩn
  ExpoSpeechRecognitionModule = null;
  useSpeechRecognitionEvent = () => {};
}

// Tách văn bản thành các đoạn nhỏ <= 170 ký tự để tạo audio mượt mà
function splitTextIntoTtsChunks(text, maxLen = 170) {
  if (!text) return [];
  if (text.length <= maxLen) return [text];

  const chunks = [];
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];

  let currentChunk = '';
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    if ((currentChunk + ' ' + trimmed).trim().length <= maxLen) {
      currentChunk = (currentChunk + ' ' + trimmed).trim();
    } else {
      if (currentChunk) chunks.push(currentChunk);

      if (trimmed.length <= maxLen) {
        currentChunk = trimmed;
      } else {
        const words = trimmed.split(' ');
        let wordChunk = '';
        for (const w of words) {
          if ((wordChunk + ' ' + w).trim().length <= maxLen) {
            wordChunk = (wordChunk + ' ' + w).trim();
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = w;
          }
        }
        currentChunk = wordChunk;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// Chuyển đổi Uint8Array nhị phân sang Base64 chuẩn hóa
function uint8ArrayToBase64(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let b64 = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;
    b64 += chars[b1 >> 2];
    b64 += chars[((b1 & 3) << 4) | (b2 >> 4)];
    b64 += i + 1 < len ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    b64 += i + 2 < len ? chars[b3 & 63] : '=';
  }
  return b64;
}

// Danh sách ngôn ngữ hỗ trợ
const LANGUAGES = [
  { code: 'vi-VN', label: 'Tiếng Việt 🇻🇳' },
  { code: 'en-US', label: 'English 🇺🇸' },
  { code: 'ja-JP', label: '日本語 🇯🇵' },
  { code: 'ko-KR', label: '한국어 🇰🇷' },
  { code: 'zh-CN', label: '中文 🇨🇳' },
  { code: 'fr-FR', label: 'Français 🇫🇷' },
];

// Danh sách giọng đọc AI Tiếng Việt (8 giọng đa dạng vùng miền & phân biệt Nam/Nữ cực rõ ràng)
const VIETNAMESE_VOICES = [
  {
    id: 'vn-mai',
    name: 'Hà Tiểu Mai',
    gender: 'female',
    genderLabel: 'Nữ',
    region: 'Miền Bắc',
    style: 'Truyền cảm • Trong trẻo',
    avatar: '👧',
    sample: 'Xin chào! Tôi là Hà Tiểu Mai, giọng đọc nữ miền Bắc trong trẻo và dịu dàng.',
    pitch: 1.35,
    rate: 0.95,
    badge: 'Phổ biến',
  },
  {
    id: 'vn-dung',
    name: 'Mạnh Dũng',
    gender: 'male',
    genderLabel: 'Nam',
    region: 'Miền Bắc',
    style: 'Trầm ấm • Nam tính',
    avatar: '👨',
    sample: 'Xin chào! Tôi là Mạnh Dũng, giọng đọc nam miền Bắc trầm ấm và mạnh mẽ.',
    pitch: 0.58,
    rate: 0.88,
    badge: 'Nam Trầm',
  },
  {
    id: 'vn-nhi',
    name: 'Thảo Nhi',
    gender: 'female',
    genderLabel: 'Nữ',
    region: 'Miền Nam',
    style: 'Ngọt ngào • Reviewer',
    avatar: '👩',
    sample: 'Xin chào mọi người! Em là Thảo Nhi, giọng nữ miền Nam ngọt ngào và duyên dáng nè.',
    pitch: 1.48,
    rate: 1.05,
    badge: 'Reviewer',
  },
  {
    id: 'vn-hoang',
    name: 'Minh Hoàng',
    gender: 'male',
    genderLabel: 'Nam',
    region: 'Miền Nam',
    style: 'Hiện đại • Nam Vlog',
    avatar: '🧑',
    sample: 'Chào các bạn! Mình là Minh Hoàng, giọng nam miền Nam năng động, tự tin.',
    pitch: 0.68,
    rate: 1.02,
    badge: 'Vlog Nam',
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
    pitch: 1.25,
    rate: 0.88,
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
    sample: 'Helo anh em! Bảo Nam đây, giọng nam trẻ sôi nổi cho video ngắn nhé!',
    pitch: 0.75,
    rate: 1.15,
    badge: 'TikTok Nam',
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
    pitch: 1.15,
    rate: 1.0,
    badge: 'MC Nữ',
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
    pitch: 0.62,
    rate: 0.90,
    badge: 'Sách nói Nam',
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
  const [isCopied, setIsCopied] = useState(false);

  // --- Văn bản → Giọng nói (TTS) ---
  const [ttsText, setTtsText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiActionType, setAiActionType] = useState('');
  const [ttsLang, setTtsLang] = useState('vi-VN');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechPitch, setSpeechPitch] = useState(1.0);
  const sttInputRef = useRef(null);

  // --- Chọn giọng đọc AI ---
  const [selectedVoiceId, setSelectedVoiceId] = useState('vn-mai');
  const [previewingVoiceId, setPreviewingVoiceId] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');

  // Animation cho nút mic
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const pulseLoop = useRef(null);
  const [nativeVoices, setNativeVoices] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await Speech.getAvailableVoicesAsync();
        if (list && Array.isArray(list)) {
          setNativeVoices(list);
        }
      } catch {
        // safe
      }
    })();
  }, []);

  // Tìm voice identifier hệ thống phù hợp với giới tính đã chọn
  const getMatchingVoiceIdentifier = useCallback((targetVoice, lang) => {
    if (!nativeVoices || !nativeVoices.length) return undefined;
    const prefix = (lang || 'vi').split('-')[0].toLowerCase();
    const matchingLang = nativeVoices.filter((v) =>
      v.language?.toLowerCase().startsWith(prefix)
    );
    if (!matchingLang.length) return undefined;

    if (targetVoice?.gender === 'male') {
      const maleVoice = matchingLang.find((v) => {
        const name = (v.name || '').toLowerCase();
        const id = (v.identifier || '').toLowerCase();
        return name.includes('male') || name.includes('khoi') || name.includes('an') || name.includes('nam') || id.includes('male');
      });
      if (maleVoice) return maleVoice.identifier;
    } else if (targetVoice?.gender === 'female') {
      const femaleVoice = matchingLang.find((v) => {
        const name = (v.name || '').toLowerCase();
        const id = (v.identifier || '').toLowerCase();
        return name.includes('female') || name.includes('linh') || name.includes('mai') || id.includes('female');
      });
      if (femaleVoice) return femaleVoice.identifier;
    }

    return matchingLang[0]?.identifier;
  }, [nativeVoices]);

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

  // Xử lý khi người dùng đổi ngôn ngữ đọc
  const handleSelectTtsLang = (langCode) => {
    setSttLang(langCode);
    setTtsLang(langCode);
    if (langCode === 'vi-VN') setSelectedVoiceId('vn-mai');
    else if (langCode === 'en-US') setSelectedVoiceId('en-jenny');
    else setSelectedVoiceId('intl-sakura');
    setFilterCategory('all');
  };

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      try {
        ExpoSpeechRecognitionModule?.abort?.();
        Speech?.stop?.();
      } catch {
        // Safe cleanup
      }
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
  const startListening = useCallback(() => {
    setIsListening(true);
    sttInputRef.current?.focus();

    if (ExpoSpeechRecognitionModule?.start) {
      setPartialTranscript('');
      try {
        ExpoSpeechRecognitionModule.start({
          lang: sttLang,
          interimResults: true,
          continuous: false,
          androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'free_form' },
        });
      } catch {
        // safe
      }
    }
  }, [sttLang]);

  // ============================================================
  // STT: DỪNG NGHE
  // ============================================================
  const stopListening = useCallback(() => {
    setIsListening(false);
    try {
      ExpoSpeechRecognitionModule?.stop?.();
    } catch {
      // safe
    }
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
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
    Alert.alert('Đã sao chép ✅', 'Văn bản đã được sao chép vào clipboard.');
  }, []);

  const handleQuickCopy = useCallback(async (textToCopy) => {
    const content = (textToCopy || '').trim();
    if (!content) {
      Alert.alert('Chưa có nội dung', 'Vui lòng đọc hoặc nhập văn bản trước khi sao chép.');
      return;
    }
    await Clipboard.setStringAsync(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
    Alert.alert('Đã sao chép! 📋', 'Đoạn văn bản đã được sao chép vào bộ nhớ tạm. Bạn có thể dán vào bất cứ đâu.');
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setPartialTranscript('');
  }, []);

  // Gemini AI: Tút lại câu & sửa lỗi chính tả
  const handlePolishWithAi = useCallback(async () => {
    const raw = (transcript || partialTranscript || '').trim();
    if (!raw) {
      Alert.alert('Chưa có văn bản', 'Vui lòng đọc hoặc nhập nội dung để Gemini AI tút lại câu từ.');
      return;
    }
    setIsAiProcessing(true);
    setAiActionType('polish');
    try {
      const polished = await polishTranscriptWithAi(raw);
      if (polished) {
        setTranscript(polished);
        setPartialTranscript('');
        Alert.alert('Gemini AI ✨', 'Đã chuẩn hóa câu từ, thêm dấu câu và sửa chính tả thành công!');
      }
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không thể xử lý văn bản bằng AI.');
    } finally {
      setIsAiProcessing(false);
      setAiActionType('');
    }
  }, [transcript, partialTranscript]);

  // Gemini AI: Tóm tắt ý chính
  const handleSummarizeWithAi = useCallback(async () => {
    const raw = (transcript || partialTranscript || '').trim();
    if (!raw) {
      Alert.alert('Chưa có văn bản', 'Vui lòng đọc hoặc nhập nội dung để Gemini AI tóm tắt.');
      return;
    }
    setIsAiProcessing(true);
    setAiActionType('summarize');
    try {
      const summary = await summarizeTranscriptWithAi(raw);
      if (summary) {
        Alert.alert(
          'Tóm tắt ý chính (Gemini AI) 📝',
          summary,
          [
            { text: 'Đóng', style: 'cancel' },
            {
              text: 'Thay thế vào ô nhập',
              onPress: () => {
                setTranscript(summary);
                setPartialTranscript('');
              },
            },
            {
              text: 'Sao chép',
              onPress: async () => {
                await Clipboard.setStringAsync(summary);
                Alert.alert('Đã sao chép 📋', 'Đã sao chép bản tóm tắt vào clipboard.');
              },
            },
          ]
        );
      }
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không thể tóm tắt bằng AI.');
    } finally {
      setIsAiProcessing(false);
      setAiActionType('');
    }
  }, [transcript, partialTranscript]);

  // Gemini AI: Viết lại giọng đọc TTS
  const handleRewriteTone = useCallback(async (toneName) => {
    const raw = ttsText.trim();
    if (!raw) {
      Alert.alert('Chưa có nội dung', 'Vui lòng nhập văn bản trước khi viết lại.');
      return;
    }
    setIsAiProcessing(true);
    setAiActionType('rewrite');
    try {
      const rewritten = await rewriteTextToneWithAi(raw, toneName);
      if (rewritten) {
        setTtsText(rewritten);
        Alert.alert('Gemini AI ✨', `Đã viết lại văn bản theo phong cách '${toneName}'!`);
      }
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không thể viết lại bằng AI.');
    } finally {
      setIsAiProcessing(false);
      setAiActionType('');
    }
  }, [ttsText]);

  // ============================================================
  // TTS: NGHE THỬ GIỌNG ĐỌC MẪU (Sử dụng expo-speech chuẩn native)
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

      const finalPitch = Math.max(0.45, Math.min(1.9, voice.pitch || 1.0));
      const finalRate = Math.max(0.5, Math.min(1.8, voice.rate || 1.0));
      const matchedVoice = getMatchingVoiceIdentifier(voice, ttsLang);

      Speech.speak(voice.sample, {
        language: ttsLang,
        voice: matchedVoice,
        pitch: finalPitch,
        rate: finalRate,
        onDone: () => setPreviewingVoiceId(null),
        onStopped: () => setPreviewingVoiceId(null),
        onError: () => setPreviewingVoiceId(null),
      });
    } catch {
      setPreviewingVoiceId(null);
    }
  }, [previewingVoiceId, ttsLang, getMatchingVoiceIdentifier]);

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
    const finalPitch = Math.max(0.45, Math.min(1.9, (voice.pitch || 1.0) * speechPitch));
    const finalRate = Math.max(0.5, Math.min(1.8, (voice.rate || 1.0) * speechRate));
    const matchedVoice = getMatchingVoiceIdentifier(voice, ttsLang);

    try {
      Speech.speak(text, {
        language: ttsLang,
        voice: matchedVoice,
        pitch: finalPitch,
        rate: finalRate,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => {
          setIsSpeaking(false);
          Alert.alert('Lỗi đọc', 'Không thể đọc văn bản này trên thiết bị.');
        },
      });
    } catch {
      setIsSpeaking(false);
      Alert.alert('Lỗi đọc', 'Không thể khởi động đọc văn bản trên thiết bị.');
    }
  }, [ttsText, isSpeaking, currentVoice, speechPitch, speechRate, ttsLang, getMatchingVoiceIdentifier]);

  const stopSpeaking = useCallback(async () => {
    await Speech.stop();
    setIsSpeaking(false);
    setPreviewingVoiceId(null);
  }, []);

  // ============================================================
  // TTS: TẢI ÂM THANH GIỌNG ĐỌC VĂN BẢN (.MP3)
  // ============================================================
  const handleDownloadTtsAudio = useCallback(async () => {
    const text = ttsText.trim();
    if (!text) {
      Alert.alert('Thiếu nội dung', 'Vui lòng nhập văn bản cần chuyển thành file âm thanh.');
      return;
    }

    setIsDownloadingAudio(true);
    try {
      const safeVoiceName = (currentVoice?.name || 'giong_ai').replace(/[^a-zA-Z0-9]/g, '_');
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';

      // Ưu tiên 1: Tạo âm thanh AI thật bằng Google Gemini (Chuẩn Nam / Nữ 100%)
      const geminiAudio = await synthesizeSpeechWithGemini(text, currentVoice?.gender || 'female');
      if (geminiAudio && geminiAudio.audioBase64) {
        const filename = `giong_ai_${safeVoiceName}_${Date.now()}.wav`;
        const fileUri = `${baseDir}${filename}`;

        await FileSystem.writeAsStringAsync(fileUri, geminiAudio.audioBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'audio/wav',
            dialogTitle: `Lưu file âm thanh AI (${currentVoice?.name || 'Giọng AI'})`,
            UTI: 'com.microsoft.waveform-audio',
          });
        } else {
          Alert.alert('Đã tạo thành công 🎉', `File âm thanh AI chất lượng cao đã sẵn sàng: ${filename}`);
        }
        return;
      }

      // Dự phòng: Engine TTS chuẩn hóa
      const chunks = splitTextIntoTtsChunks(text, 170);
      const langPrefix = (ttsLang || 'vi-VN').split('-')[0];

      const buffers = [];
      for (let i = 0; i < chunks.length; i++) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langPrefix}&client=tw-ob&q=${encodeURIComponent(chunks[i])}`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          },
        });
        if (!res.ok) {
          throw new Error(`Máy chủ âm thanh phản hồi mã ${res.status}. Vui lòng thử lại.`);
        }
        const buf = await res.arrayBuffer();
        buffers.push(new Uint8Array(buf));
      }

      let totalLength = 0;
      for (const b of buffers) totalLength += b.byteLength;
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const b of buffers) {
        combined.set(b, offset);
        offset += b.byteLength;
      }

      const base64Audio = uint8ArrayToBase64(combined);
      const filename = `giong_ai_${safeVoiceName}_${Date.now()}.mp3`;
      const fileUri = `${baseDir}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'audio/mpeg',
          dialogTitle: 'Lưu hoặc chia sẻ file âm thanh giọng đọc (.mp3)',
          UTI: 'public.mp3',
        });
      } else {
        Alert.alert(
          'Đã tải thành công 🎉',
          `File âm thanh MP3 đã được tạo thành công: ${filename}`
        );
      }
    } catch (err) {
      Alert.alert('Không thể tạo file âm thanh', err.message || 'Có lỗi xảy ra trong quá trình tạo file. Vui lòng thử lại.');
    } finally {
      setIsDownloadingAudio(false);
    }
  }, [ttsText, ttsLang, currentVoice]);

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
          {isListening ? 'Đang lắng nghe... chạm để dừng' : 'Nhấn để bắt đầu nói'}
        </Text>
      </View>

      <View style={[styles.dictationTipBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Ionicons name="bulb-outline" size={16} color={colors.primary} />
        <Text style={[styles.dictationTipText, { color: colors.sub }]}>
          Mẹo: Chạm vào ô bên dưới và nhấn phím Micro 🎙️ trên bàn phím ảo của điện thoại để nhận diện giọng nói tiếng Việt tức thì!
        </Text>
      </View>

      <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.resultHeader}>
          <Text style={[styles.resultTitle, { color: colors.text }]}>Văn bản nhận dạng</Text>
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
        <TextInput
          ref={sttInputRef}
          style={[styles.transcriptInput, { color: colors.text }]}
          value={transcript || partialTranscript}
          onChangeText={setTranscript}
          placeholder="Chạm vào đây và bấm phím Micro 🎙️ trên bàn phím để đọc..."
          placeholderTextColor={colors.sub}
          multiline
          scrollEnabled={false}
        />
        {transcript ? (
          <Text style={[styles.wordCount, { color: colors.sub }]}>
            {transcript.trim().split(/\s+/).length} từ • {transcript.length} ký tự
          </Text>
        ) : null}

        {/* Mẫu thử văn bản nhanh khi kiểm thử */}
        <View style={styles.sampleChipsContainer}>
          <Text style={[styles.sampleChipsTitle, { color: colors.sub }]}>⚡ Mẫu thử nhanh:</Text>
          <View style={styles.sampleChipsRow}>
            <Pressable
              onPress={() => setTranscript('ờ thì là mà hôm nay nhóm em hoàn thành bài tập dự án di động rất tốt nhé')}
              style={[styles.sampleChip, { backgroundColor: colors.cardElevated }]}
            >
              <Text style={[styles.sampleChipText, { color: colors.primary }]}>Thử mẫu 1 (Có từ đệm)</Text>
            </Pressable>
            <Pressable
              onPress={() => setTranscript('Nhắc nhở nộp báo cáo môn học vào lúc năm giờ chiều nay tại phòng thực hành.')}
              style={[styles.sampleChip, { backgroundColor: colors.cardElevated }]}
            >
              <Text style={[styles.sampleChipText, { color: colors.primary }]}>Thử mẫu 2 (Công việc)</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Bộ công cụ Gemini AI cho văn bản nhận dạng */}
      <View style={[styles.aiToolbar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.aiToolbarHeader}>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={14} color="#7C3AED" />
            <Text style={styles.aiBadgeText}>Trợ lý Gemini AI</Text>
          </View>
        </View>

        <View style={styles.aiActionsRow}>
          <Pressable
            onPress={handlePolishWithAi}
            disabled={(!transcript && !partialTranscript) || isAiProcessing}
            style={[
              styles.aiActionChip,
              {
                backgroundColor: colors.cardElevated,
                borderColor: colors.cardBorder,
                opacity: (!transcript && !partialTranscript) || isAiProcessing ? 0.5 : 1,
              },
            ]}
          >
            <Ionicons name="color-wand-outline" size={16} color="#7C3AED" />
            <Text style={[styles.aiActionText, { color: colors.text }]}>
              {aiActionType === 'polish' && isAiProcessing ? 'Đang tút lại...' : 'Tút câu & chính tả ✨'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSummarizeWithAi}
            disabled={(!transcript && !partialTranscript) || isAiProcessing}
            style={[
              styles.aiActionChip,
              {
                backgroundColor: colors.cardElevated,
                borderColor: colors.cardBorder,
                opacity: (!transcript && !partialTranscript) || isAiProcessing ? 0.5 : 1,
              },
            ]}
          >
            <Ionicons name="list-outline" size={16} color="#3B82F6" />
            <Text style={[styles.aiActionText, { color: colors.text }]}>
              {aiActionType === 'summarize' && isAiProcessing ? 'Đang tóm tắt...' : 'Tóm tắt ý chính 📝'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Nút sao chép nhanh toàn bộ văn bản */}
      <Pressable
        onPress={() => handleQuickCopy(transcript || partialTranscript)}
        disabled={!transcript && !partialTranscript}
        style={[
          styles.quickCopyBtn,
          {
            backgroundColor: isCopied ? colors.success : colors.primary,
            opacity: !transcript && !partialTranscript ? 0.45 : 1,
          },
        ]}
      >
        <Ionicons
          name={isCopied ? 'checkmark-circle' : 'copy'}
          size={20}
          color={isCopied ? '#FFFFFF' : colors.primaryText}
        />
        <Text
          style={[
            styles.quickCopyBtnText,
            { color: isCopied ? '#FFFFFF' : colors.primaryText },
          ]}
        >
          {isCopied ? 'Đã sao chép vào bộ nhớ tạm! ✓' : 'Sao chép nhanh toàn bộ văn bản 📋'}
        </Text>
      </Pressable>

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

      {/* Viết lại văn phong đọc bằng Gemini AI */}
      <View style={[styles.aiRewriteBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.aiToolbarHeader}>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={14} color="#7C3AED" />
            <Text style={styles.aiBadgeText}>Gemini AI viết lại văn phong đọc</Text>
          </View>
        </View>
        <View style={styles.toneChipsRow}>
          {[
            { id: 'mc', label: '🎙️ MC Tin tức', tone: 'MC Tin tức truyền thanh chuẩn mực, trang trọng' },
            { id: 'review', label: '🌟 Reviewer cuốn hút', tone: 'Reviewer mạng xã hội sôi nổi, tự nhiên, cuốn hút' },
            { id: 'short', label: '⚡ Ngắn gọn súc tích', tone: 'Ngắn gọn, súc tích, đi thẳng vào trọng tâm' },
          ].map((t) => (
            <Pressable
              key={t.id}
              onPress={() => handleRewriteTone(t.tone)}
              disabled={!ttsText.trim() || isAiProcessing}
              style={[
                styles.toneChip,
                {
                  backgroundColor: colors.cardElevated,
                  borderColor: colors.cardBorder,
                  opacity: !ttsText.trim() || isAiProcessing ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.toneChipText, { color: colors.text }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ===== DANH SÁCH GIỌNG ĐỌC AI (GOOGLE & HỆ THỐNG) ===== */}
      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.settingTitleRow}>
          <Ionicons name="people" size={20} color="#7C3AED" />
          <Text style={[styles.settingTitle, { color: colors.text }]}>
            Chọn giọng đọc AI ({filteredVoices.length} giọng)
          </Text>
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

      {/* Nút tải âm thanh MP3 về máy */}
      <Pressable
        onPress={handleDownloadTtsAudio}
        disabled={!ttsText.trim() || isDownloadingAudio}
        style={[
          styles.downloadAudioBtn,
          {
            backgroundColor: !ttsText.trim() ? colors.cardElevated : '#059669',
            opacity: !ttsText.trim() ? 0.5 : 1,
          },
        ]}
      >
        {isDownloadingAudio ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons
            name="cloud-download-outline"
            size={22}
            color={!ttsText.trim() ? colors.sub : '#FFFFFF'}
          />
        )}
        <Text
          style={[
            styles.downloadAudioBtnText,
            { color: !ttsText.trim() ? colors.sub : '#FFFFFF' },
          ]}
        >
          {isDownloadingAudio ? 'Đang tạo file MP3...' : 'Tải file âm thanh giọng đọc (.MP3) 📥'}
        </Text>
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

      {/* Hộp giải thích về giọng AI & phong cách Vbee */}
      <View style={[styles.vbeeNoteBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Ionicons name="sparkles-outline" size={20} color="#7C3AED" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.vbeeNoteTitle, { color: colors.text }]}>
            Kho giọng đọc AI đa phong cách
          </Text>
          <Text style={[styles.vbeeNoteDesc, { color: colors.sub }]}>
            Hệ thống cung cấp 8 nhân vật giọng AI tiếng Việt theo vùng miền (Bắc - Trung - Nam). Bạn có thể bấm nghe thử và tải file MP3 trực tiếp về điện thoại hoàn toàn miễn phí.
          </Text>
        </View>
      </View>
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
                Nhận dạng giọng nói thành văn bản & Đọc văn bản với giọng đọc AI Google và đa ngôn ngữ tự nhiên.
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
  dictationTipBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 14,
  },
  dictationTipText: { fontSize: 12, fontWeight: '500', flex: 1, lineHeight: 17 },

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
  transcriptInput: { fontSize: 16, lineHeight: 24, minHeight: 80, textAlignVertical: 'top', padding: 0 },
  transcriptText: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  partialText: { fontSize: 15, lineHeight: 22, fontStyle: 'italic', marginTop: 4 },
  placeholderText: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 12 },
  wordCount: { fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'right' },
  sampleChipsContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  sampleChipsTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  sampleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sampleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sampleChipText: {
    fontSize: 11,
    fontWeight: '700',
  },

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

  downloadAudioBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 16, marginBottom: 14, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  downloadAudioBtnText: { fontSize: 15, fontWeight: '800' },

  quickCopyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 14, marginBottom: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  quickCopyBtnText: { fontSize: 15, fontWeight: '800' },

  vbeeNoteBox: {
    flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14,
    borderWidth: 1, marginTop: 8, marginBottom: 12, alignItems: 'flex-start',
  },
  vbeeNoteTitle: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  vbeeNoteDesc: { fontSize: 12, lineHeight: 18, fontWeight: '500' },

  // Gemini AI Toolbars
  aiToolbar: {
    borderRadius: 16, padding: 12, borderWidth: 1,
    marginBottom: 12,
  },
  aiToolbarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  aiBadgeText: {
    fontSize: 13, fontWeight: '800', color: '#7C3AED',
  },
  keyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
  },
  keyBtnText: {
    fontSize: 11, fontWeight: '700', color: '#7C3AED',
  },
  aiStatusText: {
    fontSize: 11, fontWeight: '600',
  },
  aiActionsRow: {
    flexDirection: 'row', gap: 8,
  },
  aiActionChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1,
  },
  aiActionText: {
    fontSize: 12, fontWeight: '700',
  },

  aiRewriteBox: {
    borderRadius: 16, padding: 12, borderWidth: 1,
    marginBottom: 14,
  },
  toneChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  toneChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  toneChipText: {
    fontSize: 12, fontWeight: '700',
  },

  activeVoiceBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8,
  },
  activeVoiceTitle: { fontSize: 13, fontWeight: '700' },
  activeVoiceSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
});
