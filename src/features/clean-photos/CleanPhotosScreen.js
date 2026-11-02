import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';

export default function CleanPhotosScreen({ navigation }) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Dọn ảnh trùng lặp"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="information-circle-outline" size={36} color={colors.primary} />
        </View>
        <Text style={[styles.unavailableTitle, { color: colors.text }]}>Chưa hỗ trợ quét ảnh trùng</Text>
        <Text style={[styles.statDesc, { color: colors.sub }]}>
          Ứng dụng chưa có khả năng quét và xóa ảnh trùng trên thiết bị. Không có ảnh hoặc dung lượng nào được báo giả.
        </Text>
        <Pressable onPress={() => navigation?.goBack()} style={[styles.cleanBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.cleanBtnText}>Quay lại</Text>
        </Pressable>
      </View>
          </>
        }
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      />
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
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 208, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  unavailableTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  statDesc: {
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  cleanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    gap: 8,
    width: '100%',
    overflow: 'hidden',
  },
  cleanBtnText: {
    color: '#121214',
    fontSize: 15.5,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  thumbBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  groupSub: {
    fontSize: 13,
    marginTop: 2,
  },
  keepBestBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  emptyBox: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    marginTop: 4,
  },
});
