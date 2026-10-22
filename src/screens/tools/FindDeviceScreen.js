import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';

export default function FindDeviceScreen({ navigation }) {
  const { colors } = useTheme();
  const [ringing, setRinging] = useState(false);

  const handleRing = () => {
    setRinging(true);
    Alert.alert('Đang phát chuông 🔊', 'Điểm phát chuông định vị với âm lượng lớn nhất đang được kích hoạt!', [
      { text: 'Dừng chuông', onPress: () => setRinging(false) },
    ]);
  };

  const handleLock = () => {
    Alert.alert('Khóa thiết bị', 'Bạn có muốn khóa màn hình thiết bị và gửi thông điệp liên hệ khẩn cấp?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Khóa ngay', style: 'destructive', onPress: () => Alert.alert('Đã khóa', 'Thiết bị đã chuyển sang chế độ an toàn.') },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Tìm vị trí thiết bị"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Vị trí bản đồ Mock */}
      <View style={[styles.mapCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.radarWrapper}>
          <View style={[styles.radarOuter, { borderColor: colors.primary }]}>
            <View style={[styles.radarInner, { backgroundColor: 'rgba(255, 208, 0, 0.15)' }]}>
              <Ionicons name="phone-portrait" size={32} color={colors.primary} />
            </View>
          </View>
        </View>

        <Text style={styles.deviceName}>Thiết bị này: iPhone 15 Pro</Text>
        <Text style={[styles.deviceLocation, { color: colors.sub }]}>
          Vị trí: Quận Cầu Giấy, Hà Nội • Cập nhật: Vừa xong
        </Text>

        <View style={styles.infoRow}>
          <View style={styles.infoBadge}>
            <Ionicons name="battery-charging" size={16} color="#10B981" />
            <Text style={styles.infoBadgeText}>Pin 85%</Text>
          </View>
          <View style={styles.infoBadge}>
            <Ionicons name="wifi" size={16} color={colors.primary} />
            <Text style={styles.infoBadgeText}>Wifi kết nối</Text>
          </View>
          <View style={styles.infoBadge}>
            <Ionicons name="navigate" size={16} color="#06B6D4" />
            <Text style={styles.infoBadgeText}>GPS chuẩn xác</Text>
          </View>
        </View>
      </View>

      {/* Hành động tìm máy */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleRing}
          style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.primary }]}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(255, 208, 0, 0.15)' }]}>
            <Ionicons name="volume-high" size={28} color={colors.primary} />
          </View>
          <Text style={styles.actionTitle}>Phát chuông</Text>
          <Text style={[styles.actionSub, { color: colors.sub }]}>Đổ chuông to để tìm trong phòng</Text>
        </Pressable>

        <Pressable
          onPress={handleLock}
          style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Ionicons name="lock-closed" size={28} color="#EF4444" />
          </View>
          <Text style={styles.actionTitle}>Khóa khẩn cấp</Text>
          <Text style={[styles.actionSub, { color: colors.sub }]}>Khóa máy và hiển thị số liên hệ</Text>
        </Pressable>
      </View>
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
  mapCard: {
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  radarWrapper: {
    marginVertical: 14,
  },
  radarOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  deviceLocation: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  infoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    overflow: 'hidden',
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actionSub: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
});
