import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader } from '../components/ui';
import { useTheme } from '../theme';

const SAMPLES = [
  'Báo cáo dự án hôm nay tiến độ đến đâu rồi em?',
  'Sản phẩm này bên bạn còn hàng không, giá bao nhiêu ạ?',
  'Tối nay rảnh không, đi cafe nói chuyện xíu bạn ơi?',
];

export default function AiReplyScreen({ navigation }) {
  const { colors } = useTheme();
  const [incomingMsg, setIncomingMsg] = useState(SAMPLES[0]);
  const [analyzing, setAnalyzing] = useState(false);
  const [replies, setReplies] = useState([
    {
      tone: 'Lịch sự & Chuyên nghiệp',
      icon: 'briefcase',
      color: '#3B82F6',
      text: 'Dạ chào sếp, em đã hoàn thành 90% các hạng mục và đang tổng hợp số liệu để gửi báo cáo chi tiết cho sếp trước 17h hôm nay ạ!',
    },
    {
      tone: 'Thân thiện & Tự nhiên',
      icon: 'happy',
      color: '#10B981',
      text: 'Em đang kiểm tra lại lần cuối để gửi sếp đây ạ, cơ bản mọi thứ chạy rất mượt và đúng kế hoạch sếp nhé!',
    },
    {
      tone: 'Ngắn gọn & Nhanh',
      icon: 'flash',
      color: '#F59E0B',
      text: 'Tiến độ đang đạt 90%, em sẽ nộp báo cáo hoàn chỉnh vào cuối giờ chiều nay ạ.',
    },
  ]);

  const handleGenerate = () => {
    if (!incomingMsg.trim()) {
      Alert.alert('Chưa có tin nhắn', 'Hãy nhập hoặc dán nội dung tin nhắn bạn vừa nhận được.');
      return;
    }
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      Alert.alert('AI Phân tích xong! ✨', 'Đã đọc ngữ cảnh và tạo 3 gợi ý phản hồi phù hợp nhất.');
    }, 800);
  };

  const copyReply = (text) => {
    Alert.alert('Đã chọn câu trả lời', `Nội dung đã được sao chép:\n"${text}"\n\nBạn có thể dán ngay vào Messenger/Zalo để gửi.`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="AI Gợi ý trả lời"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Khung nhập tin nhắn nhận được */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="chatbubbles" size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Tin nhắn bạn nhận được</Text>
        </View>

        <TextInput
          value={incomingMsg}
          onChangeText={setIncomingMsg}
          multiline
          placeholder="Dán hoặc gõ tin nhắn nhận được vào đây..."
          placeholderTextColor={colors.sub}
          style={[styles.msgInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
        />

        <Text style={[styles.sampleLabel, { color: colors.sub }]}>Gợi ý tin nhắn mẫu:</Text>
        <View style={styles.samplesRow}>
          {SAMPLES.map((s, idx) => (
            <Pressable
              key={idx}
              onPress={() => setIncomingMsg(s)}
              style={[styles.samplePill, { backgroundColor: colors.bg, borderColor: colors.border }]}
            >
              <Text style={{ color: colors.sub, fontSize: 12 }} numberOfLines={1}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleGenerate}
          disabled={analyzing}
          style={[styles.analyzeBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="sparkles" size={18} color="#121214" />
          <Text style={styles.analyzeBtnText}>
            {analyzing ? 'AI đang phân tích ngữ cảnh...' : 'AI phân tích & gợi ý trả lời'}
          </Text>
        </Pressable>
      </View>

      {/* Danh sách 3 gợi ý trả lời từ AI */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Gợi ý phản hồi thông minh</Text>

      {replies.map((reply, idx) => (
        <View
          key={idx}
          style={[styles.replyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        >
          <View style={styles.replyTop}>
            <View style={[styles.toneBadge, { backgroundColor: reply.color + '22' }]}>
              <Ionicons name={reply.icon} size={14} color={reply.color} />
              <Text style={[styles.toneText, { color: reply.color }]}>{reply.tone}</Text>
            </View>

            <Pressable
              onPress={() => copyReply(reply.text)}
              style={[styles.copyBtn, { backgroundColor: 'rgba(255, 208, 0, 0.12)' }]}
            >
              <Ionicons name="copy-outline" size={14} color={colors.primary} />
              <Text style={[styles.copyText, { color: colors.primary }]}>Sao chép</Text>
            </Pressable>
          </View>

          <Text style={styles.replyContent}>{reply.text}</Text>
        </View>
      ))}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  msgInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 14.5,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  sampleLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  samplesRow: {
    gap: 6,
  },
  samplePill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    gap: 8,
    marginTop: 16,
    overflow: 'hidden',
  },
  analyzeBtnText: {
    color: '#121214',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  replyCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  replyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  toneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  toneText: {
    fontSize: 12,
    fontWeight: '800',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  copyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  replyContent: {
    fontSize: 14.5,
    lineHeight: 21,
    color: '#FFFFFF',
  },
});
