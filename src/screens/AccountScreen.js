import { View, Text, Alert, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Row } from '../components/ui';
import { radius, useTheme } from '../theme';

export default function AccountScreen() {
  const { colors, isDark } = useTheme();
  const { user, signOut } = useAuth();

  const confirmLogout = () =>
    Alert.alert('Đăng xuất', 'Bạn muốn đăng xuất khỏi tài khoản?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: signOut },
    ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <View
          style={{
            width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 36, fontWeight: '700' }}>{user.name[0].toUpperCase()}</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{user.name}</Text>
        <Text style={{ color: colors.sub, marginTop: 4 }}>{user.email}</Text>
      </View>

      <View style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <Row icon="mail-outline" label="Email" value={user.email} />
        <Row icon="moon-outline" label="Giao diện" value={isDark ? 'Tối' : 'Sáng'} />
        <Row icon="log-out-outline" label="Đăng xuất" onPress={confirmLogout} danger />
      </View>
    </ScrollView>
  );
}
