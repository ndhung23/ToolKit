import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import ImageToPdfScreen from './ImageToPdfScreen';

// Mỗi tiện ích = 1 mục trong danh sách này.
// Thêm tiện ích mới: viết 1 màn hình, rồi thêm 1 dòng vào đây.
const TOOLS = [
  { id: 'pdf', title: 'Ảnh → PDF', emoji: '📄', screen: ImageToPdfScreen },
  { id: 'qr', title: 'Quét QR', emoji: '🔳', screen: null },
  { id: 'dup', title: 'Dọn ảnh trùng', emoji: '🧹', screen: null },
  { id: 'ai', title: 'AI trả lời tin nhắn', emoji: '💬', screen: null },
  { id: 'remind', title: 'Nhắc sử dụng', emoji: '⏰', screen: null },
];

export default function App() {
  const [activeId, setActiveId] = useState(null);
  const active = TOOLS.find((t) => t.id === activeId);

  if (active?.screen) {
    const Screen = active.screen;
    return <Screen onBack={() => setActiveId(null)} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Toolbox</Text>
      <View style={styles.grid}>
        {TOOLS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={styles.card}
            onPress={() =>
              t.screen ? setActiveId(t.id) : Alert.alert('Sắp có', `${t.title} chưa được làm.`)
            }
          >
            <Text style={styles.emoji}>{t.emoji}</Text>
            <Text style={styles.cardTitle}>{t.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7', paddingTop: 70, paddingHorizontal: 16 },
  heading: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47.5%', backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 24, alignItems: 'center',
  },
  emoji: { fontSize: 36, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});