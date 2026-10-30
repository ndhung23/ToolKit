import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';
import {
  getStoredAccounts,
  getActiveAccountId,
  setActiveAccountId,
  saveOrUpdateAccount,
  removeAccount,
  updateAccountNickname,
} from './fbAccountStorage';
import FbAccountSwitcherBar from './FbAccountSwitcherBar';
import FbMessengerWebView from './FbMessengerWebView';
import FbAddAccountModal from './FbAddAccountModal';

export default function FbMultiScreen({ navigation }) {
  const { colors } = useTheme();
  const [accounts, setAccounts] = useState([]);
  const [activeAccountId, setActiveId] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Modal thêm tài khoản
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Modal đổi tên gợi nhớ (nickname)
  const [renameTargetAccount, setRenameTargetAccount] = useState(null);
  const [newNickname, setNewNickname] = useState('');

  // Nạp danh sách tài khoản đã lưu
  const loadAccounts = useCallback(async () => {
    try {
      const stored = await getStoredAccounts();
      const activeId = await getActiveAccountId();
      setAccounts(stored);

      if (stored.length > 0) {
        if (activeId && stored.some((a) => a.id === activeId)) {
          setActiveId(activeId);
        } else {
          setActiveId(stored[0].id);
          await setActiveAccountId(stored[0].id);
        }
      } else {
        setActiveId(null);
      }
    } catch (e) {
      console.error('[FbMultiScreen] loadAccounts error:', e);
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Xử lý chuyển đổi tài khoản 1 chạm
  const handleSwitchAccount = async (targetAccount) => {
    if (!targetAccount || targetAccount.id === activeAccountId) return;
    setActiveId(targetAccount.id);
    await setActiveAccountId(targetAccount.id);
  };

  // Thêm tài khoản thành công
  const handleAccountAdded = async (newAccount) => {
    try {
      const updatedList = await saveOrUpdateAccount(newAccount);
      setAccounts(updatedList);
      setActiveId(newAccount.id);
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể lưu tài khoản.');
    }
  };

  // Menu quản lý tài khoản khi nhấn giữ
  const handleLongPressAccount = (account) => {
    Alert.alert(
      account.nickname || account.name || `UID ${account.id}`,
      'Chọn thao tác bạn muốn thực hiện cho tài khoản này:',
      [
        {
          text: 'Đổi tên gợi nhớ',
          onPress: () => {
            setRenameTargetAccount(account);
            setNewNickname(account.nickname || account.name || '');
          },
        },
        {
          text: 'Đăng xuất tài khoản này',
          style: 'destructive',
          onPress: () => confirmRemoveAccount(account),
        },
        { text: 'Hủy', style: 'cancel' },
      ]
    );
  };

  // Xác nhận đăng xuất/xóa tài khoản
  const confirmRemoveAccount = (account) => {
    Alert.alert(
      'Xác nhận đăng xuất',
      `Bạn có chắc chắn muốn xóa phiên đăng nhập của "${account.nickname || account.name}" khỏi app?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              const { accounts: updatedList, newActiveId } = await removeAccount(account.id);
              setAccounts(updatedList);
              setActiveId(newActiveId);
            } catch (err) {
              Alert.alert('Lỗi', 'Không thể xóa tài khoản.');
            }
          },
        },
      ]
    );
  };

  // Lưu tên gợi nhớ
  const handleSaveRename = async () => {
    if (!renameTargetAccount) return;
    try {
      const updated = await updateAccountNickname(renameTargetAccount.id, newNickname);
      setAccounts(updated);
      setRenameTargetAccount(null);
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể cập nhật tên gợi nhớ.');
    }
  };

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || null;

  if (loadingInitial) {
    return (
      <View style={[styles.loadingCenter, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.sub }]}>Đang nạp phiên đăng nhập...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header thanh công cụ trên cùng */}
      <ScreenHeader
        title="Đa nick Messenger"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
        rightAction={
          accounts.length > 0 ? (
            <Pressable
              onPress={() => setAddModalVisible(true)}
              style={styles.iconHeaderBtn}
              hitSlop={8}
            >
              <Ionicons name="person-add" size={19} color={colors.primary} />
            </Pressable>
          ) : undefined
        }
      />

      {accounts.length === 0 ? (
        /* Màn hình giới thiệu khi chưa thêm tài khoản nào */
        <View style={styles.introContainer}>
          <View style={[styles.cardIntro, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="logo-facebook" size={38} color="#1877F2" />
            </View>

            <Text style={[styles.introTitle, { color: colors.text }]}>Đa tài khoản Messenger 1 chạm</Text>
            <Text style={[styles.introSub, { color: colors.sub }]}>
              Nhắn tin và chuyển đổi tức thì giữa các nick Facebook cá nhân, page hoặc nick phụ chỉ với 1 chạm ở đỉnh màn hình.
            </Text>

            <View style={styles.featureList}>
              <View style={styles.featureRow}>
                <Ionicons name="flash" size={18} color="#FFD000" />
                <Text style={[styles.featureText, { color: colors.text }]}>
                  Chuyển nick trong 0.1s không cần reload hoặc nhập lại OTP
                </Text>
              </View>

              <View style={styles.featureRow}>
                <Ionicons name="shield-checkmark" size={18} color="#22C55E" />
                <Text style={[styles.featureText, { color: colors.text }]}>
                  Lưu trữ cookie mã hóa an toàn tuyệt đối trong SecureStore
                </Text>
              </View>

              <View style={styles.featureRow}>
                <Ionicons name="chatbubbles" size={18} color="#1877F2" />
                <Text style={[styles.featureText, { color: colors.text }]}>
                  Giao diện Messenger Web tối ưu, ẩn sạch các menu rườm rà
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setAddModalVisible(true)}
              style={[styles.startBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="add-circle" size={20} color="#121214" />
              <Text style={styles.startBtnText}>Thêm tài khoản Facebook đầu tiên</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* Khi đã có tài khoản: Top Switcher Bar + Khung Chat Messenger */
        <View style={styles.chatLayout}>
          {/* Thanh chuyển đổi tài khoản 1 chạm nằm cố định trên đỉnh */}
          <FbAccountSwitcherBar
            accounts={accounts}
            activeAccountId={activeAccountId}
            onSwitchAccount={handleSwitchAccount}
            onAddAccount={() => setAddModalVisible(true)}
            onLongPressAccount={handleLongPressAccount}
          />

          {/* Khung chat WebView của tài khoản đang active */}
          <View style={styles.webContainer}>
            <FbMessengerWebView
              account={activeAccount}
              onRefreshSession={loadAccounts}
            />
          </View>
        </View>
      )}

      {/* Modal Thêm tài khoản */}
      <FbAddAccountModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAccountAdded={handleAccountAdded}
      />

      {/* Modal Đổi tên gợi nhớ */}
      <Modal
        visible={Boolean(renameTargetAccount)}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTargetAccount(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.renameBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.renameTitle, { color: colors.text }]}>Đổi tên gợi nhớ</Text>
            <Text style={[styles.renameSub, { color: colors.sub }]}>
              Đặt tên dễ nhớ (ví dụ: "Shop mỹ phẩm", "Nick chính", "Nick clone"):
            </Text>

            <TextInput
              value={newNickname}
              onChangeText={setNewNickname}
              placeholder="Nhập tên gợi nhớ..."
              placeholderTextColor={colors.sub}
              style={[
                styles.renameInput,
                { backgroundColor: colors.bg, borderColor: colors.cardBorder, color: colors.text },
              ]}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveRename}
            />

            <View style={styles.renameActions}>
              <Pressable
                onPress={() => setRenameTargetAccount(null)}
                style={[styles.renameBtn, { backgroundColor: colors.bg, borderColor: colors.cardBorder }]}
              >
                <Text style={{ color: colors.sub, fontWeight: '700' }}>Hủy</Text>
              </Pressable>

              <Pressable
                onPress={handleSaveRename}
                style={[styles.renameBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: '#121214', fontWeight: '800' }}>Lưu tên</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  iconHeaderBtn: {
    padding: 6,
    borderRadius: 8,
  },
  introContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  cardIntro: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(24, 119, 242, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  introSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  featureList: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 50,
    borderRadius: 14,
    gap: 8,
  },
  startBtnText: {
    color: '#121214',
    fontSize: 15,
    fontWeight: '800',
  },
  chatLayout: {
    flex: 1,
  },
  webContainer: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  renameBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  renameTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  renameSub: {
    fontSize: 12.5,
    lineHeight: 16,
    marginBottom: 14,
  },
  renameInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 18,
  },
  renameActions: {
    flexDirection: 'row',
    gap: 10,
  },
  renameBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
