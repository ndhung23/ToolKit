import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';

const INITIAL_ACCOUNTS = [
  { id: '1', name: 'Nguyễn Văn A', email: 'vana.official@gmail.com', active: true, unread: 3 },
  { id: '2', name: 'Shop Online ToolKit', email: 'shop.toolkit@gmail.com', active: false, unread: 12 },
  { id: '3', name: 'Trần Minh Đức (Nick phụ)', email: 'duc.minh99@gmail.com', active: false, unread: 0 },
];

export default function FbMultiScreen({ navigation }) {
  const { colors } = useTheme();
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);

  const switchAccount = (id) => {
    setAccounts((prev) =>
      prev.map((acc) => ({ ...acc, active: acc.id === id }))
    );
    const target = accounts.find((a) => a.id === id);
    Alert.alert('Chuyển tài khoản', `Đã chuyển đổi sang tài khoản: "${target?.name}".`);
  };

  const addAccount = () => {
    Alert.alert('Thêm tài khoản Facebook', 'Nhập thông tin hoặc quét mã QR xác thực 2 bước (2FA) để lưu phiên đăng nhập an toàn.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Quản lý Facebook"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Banner thông tin */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.topIconBox}>
          <Ionicons name="logo-facebook" size={32} color="#1877F2" />
        </View>
        <Text style={styles.cardTitle}>Quản lý đa tài khoản Facebook</Text>
        <Text style={[styles.cardSub, { color: colors.sub }]}>
          Chuyển đổi tức thì giữa các nick cá nhân và trang bán hàng mà không cần đăng xuất hoặc nhập lại OTP.
        </Text>
      </View>

      {/* Danh sách các tài khoản */}
      <View style={styles.listHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Tài khoản đã lưu ({accounts.length})</Text>
        <Pressable onPress={addAccount}>
          <Text style={[styles.addText, { color: colors.primary }]}>+ Thêm tài khoản</Text>
        </Pressable>
      </View>

      {accounts.map((acc) => (
        <View
          key={acc.id}
          style={[
            styles.accRow,
            {
              backgroundColor: colors.card,
              borderColor: acc.active ? colors.primary : colors.cardBorder,
              borderWidth: acc.active ? 1.5 : 1,
            },
          ]}
        >
          <View style={[styles.avatarBox, { backgroundColor: acc.active ? 'rgba(255, 208, 0, 0.15)' : '#2C2C34' }]}>
            <Text style={[styles.avatarLetter, { color: acc.active ? colors.primary : '#FFFFFF' }]}>
              {acc.name[0]}
            </Text>
          </View>

          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.accName}>{acc.name}</Text>
              {acc.active && (
                <View style={[styles.activeTag, { backgroundColor: colors.primary }]}>
                  <Text style={styles.activeTagText}>ĐANG DÙNG</Text>
                </View>
              )}
            </View>
            <Text style={[styles.accEmail, { color: colors.sub }]}>{acc.email}</Text>
          </View>

          {!acc.active && (
            <Pressable
              onPress={() => switchAccount(acc.id)}
              style={[styles.switchBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
            >
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Chuyển</Text>
            </Pressable>
          )}
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
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  topIconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(24, 119, 242, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  addText: {
    fontSize: 14,
    fontWeight: '700',
  },
  accRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '800',
  },
  accName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeTagText: {
    color: '#121214',
    fontSize: 9,
    fontWeight: '900',
  },
  accEmail: {
    fontSize: 12.5,
    marginTop: 2,
  },
  switchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
});
