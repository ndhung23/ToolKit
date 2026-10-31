import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { PLATFORMS, parseFacebookCookies, isAccountCookieValid } from './fbAccountStorage';
import {
  USER_AGENTS,
  generateDesktopSpoofScript,
  generateAutoDetectSessionScript,
} from './fbCookieManager';

const PLATFORM_OPTIONS = [
  {
    id: PLATFORMS.ZALO,
    name: 'Zalo Web (Khuyên dùng)',
    desc: 'Quét mã QR bằng app Zalo để đăng nhập tức thì không sợ khóa nick',
    icon: 'chatbubbles',
    color: '#0068FF',
    badge: 'Ưu tiên',
    loginUrl: 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',
  },
  {
    id: PLATFORMS.MESSENGER,
    name: 'Messenger',
    desc: 'Chuyên nhắn tin, quản lý hộp thư & chat khách hàng',
    icon: 'chatbubble-ellipses',
    color: '#0084FF',
    loginUrl: 'https://www.messenger.com/login',
  },
  {
    id: PLATFORMS.FACEBOOK,
    name: 'Facebook',
    desc: 'Lướt bảng tin, fanpage, trang cá nhân & hội nhóm',
    icon: 'logo-facebook',
    color: '#1877F2',
    loginUrl: 'https://m.facebook.com/login/?next=https%3A%2F%2Fm.facebook.com%2F',
  },
];

export default function FbAddAccountModal({
  visible,
  onClose,
  onAccountAdded,
  existingAccounts = [],
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);

  // Bước 1: Chọn nền tảng (null = đang chọn nền tảng; 'messenger' | 'facebook' | 'zalo')
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  // Tab phương thức: 'direct' (Web) | 'cookie' (Dán cookie)
  const [tab, setTab] = useState('direct');
  const [cookieInput, setCookieInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [loadingWeb, setLoadingWeb] = useState(true);

  const resetState = () => {
    setSelectedPlatform(null);
    setTab('direct');
    setCookieInput('');
    setNicknameInput('');
    setLoadingWeb(true);
  };

  const handleClose = () => {
    resetState();
    onClose && onClose();
  };

  const handleSelectPlatform = (platformId) => {
    setSelectedPlatform(platformId);
    setLoadingWeb(true);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim()) {
        setCookieInput(text.trim());
      } else {
        Alert.alert('Bộ nhớ tạm trống', 'Chưa có nội dung trong bộ nhớ tạm để dán.');
      }
    } catch (_e) {
      Alert.alert('Lỗi', 'Không thể đọc bộ nhớ tạm.');
    }
  };

  const handleCopyCommand = async () => {
    try {
      await Clipboard.setStringAsync('copy(document.cookie)');
      Alert.alert(
        'Đã sao chép',
        'Đã copy câu lệnh "copy(document.cookie)". Bạn hãy dán vào Console (F12) trên trình duyệt máy tính và nhấn Enter.'
      );
    } catch (_e) {
      // ignore
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'DUPLICATE_ACCOUNT') {
        Alert.alert(
          'Tài khoản đã tồn tại',
          `Tài khoản (UID: ${data.uid}) đã có sẵn trong danh sách. Vui lòng đăng nhập một tài khoản khác.`
        );
        return;
      }

      if (data.type === 'SESSION_DETECTED' && data.uid && data.cookies) {
        const platformObj = PLATFORM_OPTIONS.find((p) => p.id === data.platform) || PLATFORM_OPTIONS[0];
        const newAccount = {
          id: data.uid,
          platform: data.platform || selectedPlatform || PLATFORMS.MESSENGER,
          name: data.name || `${platformObj.name} ${data.uid.slice(-4)}`,
          nickname: nicknameInput.trim() || '',
          avatarUrl: data.avatarUrl || '',
          cookies: data.cookies,
        };

        Alert.alert(
          'Đăng nhập thành công',
          `Đã thêm tài khoản ${platformObj.name}: "${newAccount.name}".`,
          [
            {
              text: 'OK',
              onPress: () => {
                onAccountAdded && onAccountAdded(newAccount);
                handleClose();
              },
            },
          ]
        );
      }
    } catch (_e) {
      // ignore
    }
  };

  const handleSaveCookie = () => {
    const raw = cookieInput.trim();
    const plat = selectedPlatform || PLATFORMS.MESSENGER;

    if (!raw) {
      Alert.alert('Thiếu thông tin', 'Vui lòng dán chuỗi Cookie vào ô bên dưới.');
      return;
    }

    if (!isAccountCookieValid(raw, plat)) {
      Alert.alert(
        'Cookie không hợp lệ',
        plat === PLATFORMS.ZALO
          ? 'Cookie Zalo cần chứa thông tin phiên đăng nhập hợp lệ.'
          : 'Chuỗi Cookie Facebook/Messenger phải chứa "c_user=" và "xs=".'
      );
      return;
    }

    let uid = `user_${Date.now().toString().slice(-6)}`;
    const parsed = parseFacebookCookies(raw);
    if (plat !== PLATFORMS.ZALO) {
      if (parsed.c_user) uid = parsed.c_user;
    } else {
      if (parsed.zalo_id) {
        uid = parsed.zalo_id;
      } else if (parsed.zpw_sek) {
        uid = `zl_${parsed.zpw_sek.slice(0, 8)}`;
      }
    }

    const platformObj = PLATFORM_OPTIONS.find((p) => p.id === plat) || PLATFORM_OPTIONS[0];
    const newAccount = {
      id: uid,
      platform: plat,
      name: nicknameInput.trim() || `${platformObj.name} User ${uid.slice(-4)}`,
      nickname: nicknameInput.trim() || '',
      avatarUrl: plat === PLATFORMS.ZALO ? '' : `https://graph.facebook.com/${uid}/picture?type=large`,
      cookies: raw,
    };

    Alert.alert(
      'Thêm tài khoản thành công',
      `Đã thêm tài khoản: "${newAccount.name}".`,
      [
        {
          text: 'Bắt đầu sử dụng',
          onPress: () => {
            onAccountAdded && onAccountAdded(newAccount);
            handleClose();
          },
        },
      ]
    );
  };

  const activePlatformConfig = PLATFORM_OPTIONS.find((p) => p.id === selectedPlatform);
  const existingUids = existingAccounts.map((a) => a.id);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.modalRoot, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        {/* Header Modal */}
        <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
          {selectedPlatform ? (
            <Pressable onPress={() => setSelectedPlatform(null)} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {selectedPlatform ? `Thêm tài khoản ${activePlatformConfig?.name}` : 'Chọn nền tảng muốn thêm'}
          </Text>

          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close-circle" size={26} color={colors.sub} />
          </Pressable>
        </View>

        {/* BƯỚC 1: Chọn nền tảng (Facebook, Messenger, Zalo) */}
        {!selectedPlatform ? (
          <View style={styles.platformSelectorContainer}>
            <Text style={[styles.sectionHeading, { color: colors.sub }]}>
              Chọn dịch vụ bạn muốn đăng nhập thêm nick:
            </Text>

            {PLATFORM_OPTIONS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleSelectPlatform(item.id)}
                style={[
                  styles.platformCard,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                <View style={[styles.platformIconBox, { backgroundColor: item.color + '1A' }]}>
                  <Ionicons name={item.icon} size={28} color={item.color} />
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.platformName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.platformDesc, { color: colors.sub }]}>{item.desc}</Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color={colors.sub} />
              </Pressable>
            ))}
          </View>
        ) : (
          /* BƯỚC 2: Đăng nhập trực tiếp (Isolated Web) hoặc dán Cookie */
          <View style={{ flex: 1 }}>
            {/* Tab chuyển đổi */}
            <View style={[styles.tabBar, { backgroundColor: colors.card }]}>
              <Pressable
                onPress={() => setTab('direct')}
                style={[styles.tabItem, tab === 'direct' && { backgroundColor: colors.primary }]}
              >
                <Ionicons
                  name="globe-outline"
                  size={15}
                  color={tab === 'direct' ? '#121214' : colors.sub}
                />
                <Text style={[styles.tabText, { color: tab === 'direct' ? '#121214' : colors.sub }]}>
                  Đăng nhập Web
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setTab('cookie')}
                style={[styles.tabItem, tab === 'cookie' && { backgroundColor: colors.primary }]}
              >
                <Ionicons
                  name="code-slash-outline"
                  size={15}
                  color={tab === 'cookie' ? '#121214' : colors.sub}
                />
                <Text style={[styles.tabText, { color: tab === 'cookie' ? '#121214' : colors.sub }]}>
                  Dán Cookie
                </Text>
              </Pressable>
            </View>

            {tab === 'direct' ? (
              <View style={styles.webContainer}>
                {selectedPlatform === PLATFORMS.ZALO && (
                  <View style={[styles.zaloTipBanner, { backgroundColor: 'rgba(0, 104, 255, 0.12)', borderColor: 'rgba(0, 104, 255, 0.3)' }]}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="qr-code-outline" size={20} color="#0068FF" />
                      <Text style={[styles.zaloTipText, { color: colors.text }]}>
                        Quét mã QR bằng app Zalo máy khác HOẶC bấm [ ≡ ] để nhập SĐT & Mật khẩu.
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setLoadingWeb(true);
                        webViewRef.current?.reload();
                      }}
                      style={[styles.reloadQrBtn, { backgroundColor: '#0068FF' }]}
                      hitSlop={6}
                    >
                      <Ionicons name="reload" size={13} color="#FFFFFF" />
                      <Text style={styles.reloadQrText}>Làm mới QR</Text>
                    </Pressable>
                  </View>
                )}

                {loadingWeb && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.sub }]}>
                      Đang mở trang đăng nhập {activePlatformConfig?.name}...
                    </Text>
                  </View>
                )}

                <WebView
                  key={`login_${selectedPlatform}`}
                  ref={webViewRef}
                  source={{ uri: activePlatformConfig?.loginUrl || 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F' }}
                  incognito={false}
                  cacheEnabled={true}
                  sharedCookiesEnabled={true}
                  thirdPartyCookiesEnabled={true}
                  injectedJavaScriptBeforeContentLoaded={generateDesktopSpoofScript(selectedPlatform)}
                  injectedJavaScript={generateAutoDetectSessionScript(selectedPlatform, existingUids)}
                  onMessage={handleWebViewMessage}
                  onLoadEnd={() => setLoadingWeb(false)}
                  style={styles.webView}
                  javaScriptEnabled
                  domStorageEnabled
                  userAgent={
                    selectedPlatform === PLATFORMS.ZALO
                      ? USER_AGENTS.ZALO_DESKTOP
                      : selectedPlatform === PLATFORMS.MESSENGER
                      ? USER_AGENTS.MESSENGER_DESKTOP
                      : USER_AGENTS.FACEBOOK_MOBILE
                  }
                />
              </View>
            ) : (
              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
                <View style={styles.cookieContainer}>
                  {selectedPlatform === PLATFORMS.ZALO && (
                    <View style={[styles.guideBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <View style={styles.guideHeader}>
                        <Ionicons name="laptop-outline" size={18} color="#0068FF" />
                        <Text style={[styles.guideTitle, { color: colors.text }]}>
                          Lấy Cookie từ máy tính (Thành công 100%)
                        </Text>
                      </View>
                      <Text style={[styles.guideStep, { color: colors.sub }]}>
                        1. Mở Zalo Web (chat.zalo.me) trên máy tính đã đăng nhập.
                      </Text>
                      <Text style={[styles.guideStep, { color: colors.sub }]}>
                        2. Nhấn phím F12 (hoặc chuột phải chọn Inspect) ➔ chọn tab Console.
                      </Text>
                      <Text style={[styles.guideStep, { color: colors.sub }]}>
                        3. Gõ lệnh: copy(document.cookie) rồi nhấn Enter.
                      </Text>
                      <Text style={[styles.guideStep, { color: colors.sub }]}>
                        4. Gửi chuỗi đó sang điện thoại ➔ Bấm nút "Dán từ bộ nhớ tạm" bên dưới.
                      </Text>

                      <Pressable
                        onPress={handleCopyCommand}
                        style={[styles.copyCmdBtn, { backgroundColor: 'rgba(0, 104, 255, 0.15)', borderColor: '#0068FF' }]}
                      >
                        <Ionicons name="copy-outline" size={14} color="#0068FF" />
                        <Text style={[styles.copyCmdText, { color: '#0068FF' }]}>
                          Sao chép câu lệnh F12: copy(document.cookie)
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  <Text style={[styles.label, { color: colors.text }]}>Tên gợi nhớ (Không bắt buộc):</Text>
                  <TextInput
                    value={nicknameInput}
                    onChangeText={setNicknameInput}
                    placeholder="Ví dụ: Zalo cá nhân, Zalo bán hàng..."
                    placeholderTextColor={colors.sub}
                    style={[
                      styles.textInput,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.text },
                    ]}
                    autoCapitalize="words"
                  />

                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>
                      Chuỗi Cookie {activePlatformConfig?.name}:
                    </Text>
                    <Pressable
                      onPress={handlePasteFromClipboard}
                      style={[styles.pasteBtn, { backgroundColor: 'rgba(255, 208, 0, 0.15)' }]}
                      hitSlop={6}
                    >
                      <Ionicons name="clipboard-outline" size={13} color={colors.primary} />
                      <Text style={[styles.pasteBtnText, { color: colors.primary }]}>Dán từ bộ nhớ tạm</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={cookieInput}
                    onChangeText={setCookieInput}
                    placeholder="Dán chuỗi cookie vào đây..."
                    placeholderTextColor={colors.sub}
                    multiline
                    numberOfLines={4}
                    style={[
                      styles.cookieTextInput,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.text },
                    ]}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Pressable
                    onPress={handleSaveCookie}
                    style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#121214" />
                    <Text style={styles.saveBtnText}>Lưu và Bắt đầu Dùng</Text>
                  </Pressable>
                </View>
              </KeyboardAvoidingView>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 2,
  },
  platformSelectorContainer: {
    flex: 1,
    padding: 16,
  },
  sectionHeading: {
    fontSize: 13,
    marginBottom: 16,
    fontWeight: '600',
  },
  platformCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  platformIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  platformDesc: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 6,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  webContainer: {
    flex: 1,
    position: 'relative',
  },
  zaloTipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  zaloTipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 18, 20, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  webView: {
    flex: 1,
    backgroundColor: '#121214',
  },
  cookieContainer: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  cookieTextInput: {
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  saveBtnText: {
    color: '#121214',
    fontSize: 15,
    fontWeight: '800',
  },
  reloadQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  reloadQrText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  guideBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 4,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  guideStep: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  copyCmdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    gap: 6,
  },
  copyCmdText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  pasteBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
