import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, FlatList } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';

const DUPLICATE_GROUPS = [
  { id: '1', title: 'Chụp liên tiếp (Burst shots)', count: 4, sizeMb: 14.2, thumbColor: '#EC4899' },
  { id: '2', title: 'Ảnh tải về từ Facebook trùng', count: 3, sizeMb: 8.5, thumbColor: '#3B82F6' },
  { id: '3', title: 'Ảnh chụp màn hình tương tự', count: 5, sizeMb: 12.0, thumbColor: '#10B981' },
];

export default function CleanPhotosScreen({ navigation }) {
  const { colors } = useTheme();
  const [cleaning, setCleaning] = useState(false);
  const [cleaned, setCleaned] = useState(false);

  const totalSize = DUPLICATE_GROUPS.reduce((s, g) => s + g.sizeMb, 0).toFixed(1);
  const totalPhotos = DUPLICATE_GROUPS.reduce((s, g) => s + g.count, 0);

  const handleClean = () => {
    setCleaning(true);
    setTimeout(() => {
      setCleaning(false);
      setCleaned(true);
      Alert.alert('Dọn dẹp thành công! 🎉', `Đã dọn dẹp các bức ảnh trùng lặp, giải phóng ${totalSize} MB dung lượng bộ nhớ.`);
    }, 1200);
  };

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
            {/* Banner tổng quan dung lượng trùng */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="images" size={36} color={colors.primary} />
        </View>

        <Text style={styles.statSize}>{cleaned ? '0 MB' : `${totalSize} MB`}</Text>
        <Text style={[styles.statDesc, { color: colors.sub }]}>
          {cleaned ? 'Thư viện ảnh của bạn đã được dọn sạch hoàn toàn!' : `Phát hiện ${totalPhotos} ảnh trùng lặp có thể xóa an toàn`}
        </Text>

        {!cleaned && (
          <Pressable
            onPress={handleClean}
            disabled={cleaning}
            style={[styles.cleanBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="trash-bin" size={20} color="#121214" />
            <Text style={styles.cleanBtnText}>{cleaning ? 'Đang dọn dẹp...' : `Dọn sạch (${totalSize} MB)`}</Text>
          </Pressable>
        )}
      </View>

      {/* Danh sách các nhóm ảnh trùng */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Nhóm ảnh phát hiện</Text>

      {cleaned ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
          <Text style={styles.emptyTitle}>Không còn ảnh trùng lặp</Text>
          <Text style={[styles.emptySub, { color: colors.sub }]}>Bộ nhớ máy bạn đang rất tối ưu.</Text>
        </View>
      ) : (
        DUPLICATE_GROUPS.map((group) => (
          <View
            key={group.id}
            style={[styles.groupItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <View style={[styles.thumbBox, { backgroundColor: group.thumbColor + '22' }]}>
              <Ionicons name="duplicate" size={22} color={group.thumbColor} />
            </View>

            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <Text style={[styles.groupSub, { color: colors.sub }]}>
                {group.count} ảnh trùng • {group.sizeMb} MB
              </Text>
            </View>

            <Pressable
              onPress={() => Alert.alert(group.title, 'Đã chọn giữ lại ảnh có độ phân giải và chất lượng cao nhất.')}
              style={[styles.keepBestBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Giữ 1 ảnh tốt</Text>
            </Pressable>
          </View>
        ))
      )}
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
  statSize: {
    fontSize: 36,
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
