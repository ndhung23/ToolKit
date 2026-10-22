import { View, Text, ScrollView, Image, StyleSheet, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Row, ScreenHeader, RoleBadge } from '../../components/ui';
import { useTheme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

const FAVICON_ICON = require('../../../assets/favicon1.png');

export default function SettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();

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

          {user?.role === ROLES.ADMIN ? (
            <Row
              icon="shield-checkmark"
              label="Trang Quản trị viên (Admin Panel)"
              value="Mở ngay"
              onPress={() => navigation.navigate('AdminScreen')}
            />
          ) : (
            <View style={styles.roleNoteBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.sub} />
              <Text style={[styles.roleNoteText, { color: colors.sub }]}>
                Cấp bậc tài khoản do Quản trị viên hệ thống quản lý và phân quyền.
              </Text>
            </View>
          )}
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
          Hệ thống bảo mật và phân quyền vai trò (RBAC) tiêu chuẩn.
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
  roleNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  roleNoteText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 10,
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

