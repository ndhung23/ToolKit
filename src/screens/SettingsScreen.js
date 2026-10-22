import { View, Text, ScrollView, Image, StyleSheet, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Row, ScreenHeader, RoleBadge } from '../components/ui';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';

const FAVICON_ICON = require('../../assets/favicon1.png');

export default function SettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const { user, switchRole, upgradeToVip, demoAccounts = [] } = useAuth();

  const handleRoleChange = async (targetRole) => {
    await switchRole(targetRole);
    Alert.alert('Chuyển vai trò', `Đã chuyển tài khoản sang quyền: ${targetRole.toUpperCase()}`);
  };

  const handleUpgradeVip = async () => {
    await upgradeToVip();
    Alert.alert('Thành công', 'Đã kích hoạt quyền VIP Gold cho tài khoản của bạn!');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Cài đặt hệ thống"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* Logo & App Info */}
        <View style={styles.appBadgeContainer}>
          <View style={[styles.logoCircle, { backgroundColor: 'rgba(255, 208, 0, 0.12)' }]}>
            <Image source={FAVICON_ICON} style={styles.logoImg} resizeMode="contain" />
          </View>
          <Text style={[styles.appName, { color: colors.primary }]}>ToolKit ✨</Text>
          <Text style={[styles.versionText, { color: colors.sub }]}>Phiên bản 1.0.0 (Derot Edition)</Text>
        </View>

        {/* Thông tin tài khoản & Vai trò hiện tại */}
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.accountHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.accountName, { color: colors.text }]}>{user?.name || 'ToolKit User'}</Text>
              <Text style={[styles.accountEmail, { color: colors.sub }]}>{user?.email}</Text>
            </View>
            <RoleBadge role={user?.role} />
          </View>

          {user?.role === ROLES.FREE && (
            <Pressable
              onPress={handleUpgradeVip}
              style={[styles.vipUpgradeBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="sparkles" size={16} color="#121214" />
              <Text style={styles.vipUpgradeBtnText}>Nâng cấp tài khoản lên VIP Gold</Text>
            </Pressable>
          )}

          {user?.role === ROLES.ADMIN && (
            <Row
              icon="shield-checkmark"
              label="Trang Quản trị viên (Admin Panel)"
              value="Mở ngay"
              onPress={() => navigation.navigate('AdminScreen')}
            />
          )}
        </View>

        {/* Bộ chuyển đổi vai trò kiểm thử MMA301 */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Kiểm thử phân quyền (MMA301)</Text>
        <View style={styles.roleSwitcherRow}>
          {demoAccounts.map((acc) => {
            const isSelected = user?.role === acc.role;
            const isAdm = acc.role === ROLES.ADMIN;
            const isVp = acc.role === ROLES.VIP;
            const activeColor = isAdm ? '#EF4444' : isVp ? '#FFD000' : '#A0A0AB';

            return (
              <Pressable
                key={acc.role}
                onPress={() => handleRoleChange(acc.role)}
                style={[
                  styles.roleSwitchBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: isSelected ? activeColor : colors.cardBorder,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.roleSwitchText,
                    { color: isSelected ? activeColor : colors.text },
                  ]}
                >
                  {acc.role.toUpperCase()}
                </Text>
                <Text style={[styles.roleSwitchDesc, { color: colors.sub }]}>{acc.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Các cài đặt hệ thống */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Tùy chọn ứng dụng</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Row icon="moon" label="Giao diện" value="Tối (Derot Black & Gold)" />
          <Row icon="volume-high" label="Âm thanh chuông báo" value="Bật" />
          <Row icon="notifications" label="Nhắc nhở sử dụng" value="Mỗi 45 phút" />
          <Row icon="shield-checkmark" label="Chế độ bảo vệ" value="Nghiêm ngặt" />
        </View>

        <Text style={[styles.footerText, { color: colors.sub }]}>
          Hệ thống bảo mật và phân quyền vai trò (RBAC) đạt chuẩn MMA301.
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingTop: 16,
  },
  appBadgeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 208, 0, 0.25)',
  },
  logoImg: {
    width: 60,
    height: 60,
    borderRadius: 18,
    overflow: 'hidden',
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
  },
  versionText: {
    fontSize: 13,
    marginTop: 4,
  },
  accountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
  },
  accountEmail: {
    fontSize: 12.5,
    marginTop: 2,
  },
  vipUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    overflow: 'hidden',
  },
  vipUpgradeBtnText: {
    color: '#121214',
    fontSize: 14,
    fontWeight: '800',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 10,
  },
  roleSwitcherRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  roleSwitchBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    overflow: 'hidden',
  },
  roleSwitchText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roleSwitchDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  cardGroup: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  footerText: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
});

