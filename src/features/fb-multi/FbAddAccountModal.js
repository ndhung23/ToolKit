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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { generateAutoDetectSessionScript } from './fbCookieManager';
import { parseFacebookCookies, isFacebookCookieValid } from './fbAccountStorage';

export default function FbAddAccountModal({
  visible,
  onClose,
  onAccountAdded,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('direct'); // 'direct' | 'cookie'
  const [cookieInput, setCookieInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [loadingWeb, setLoadingWeb] = useState(true);
  const webViewRef = useRef(null);

  const resetForm = () => {
    setCookieInput('');
    setNicknameInput('');
    setTab('direct');
    setLoadingWeb(true);
  };

  const handleClose = () => {
    resetForm();
    onClose && onClose();
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'FB_SESSION_DETECTED' && data.uid && data.cookies) {
        const newAccount = {
          id: data.uid,
          name: data.name || `Facebook ${data.uid.slice(-4)}`,
          nickname: nicknameInput.trim() || '',
          avatarUrl: data.avatarUrl || `https://graph.facebook.com/${data.uid}/picture?type=large`,
          cookies: data.cookies,
        };

        Alert.alert(
          'Đăng nhập thành công',
          `Đã lưu phiên đăng nhập cho tài khoản: "${newAccount.name}".`,
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
    } catch (e) {
      // Bỏ qua các message không phải JSON
    }
  };

  const handleSaveCookie = () => {
    const raw = cookieInput.trim();
    if (!raw) {
      Alert.alert('Thiếu thông tin', 'Vui lòng dán chuỗi Cookie Facebook vào ô bên dưới.');
      return;
    }

    if (!isFacebookCookieValid(raw)) {
      Alert.alert(
        'Cookie không hợp lệ',
        'Chuỗi Cookie phải chứa định danh "c_user=" (Facebook UID) và "xs=". Vui lòng kiểm tra lại.'
      );
      return;
    }

    const parsed = parseFacebookCookies(raw);
    const uid = parsed.c_user;
    const newAccount = {
      id: uid,
      name: nicknameInput.trim() || `Facebook User ${uid.slice(-4)}`,
      nickname: nicknameInput.trim() || '',
      avatarUrl: `https://graph.facebook.com/${uid}/picture?type=large`,
      cookies: raw,
    };

    Alert.alert(
      'Thêm tài khoản thành công',
      `Đã thêm tài khoản: "${newAccount.name}".`,
      [
        {
          text: 'Bắt đầu chat',
          onPress: () => {
            onAccountAdded && onAccountAdded(newAccount);
            handleClose();
          },
        },
      ]
    );
  };

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Thêm tài khoản Facebook</Text>
          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close-circle" size={26} color={colors.sub} />
          </Pressable>
        </View>

        {/* Tab chuyển đổi phương thức thêm nick */}
        <View style={[styles.tabBar, { backgroundColor: colors.card }]}>
          <Pressable
            onPress={() => setTab('direct')}
            style={[
              styles.tabItem,
              tab === 'direct' && { backgroundColor: colors.primary },
            ]}
          >
            <Ionicons
              name="globe-outline"
              size={16}
              color={tab === 'direct' ? '#121214' : colors.sub}
            />
            <Text
              style={[
                styles.tabText,
                { color: tab === 'direct' ? '#121214' : colors.sub },
              ]}
            >
              Đăng nhập trực tiếp (Khuyên dùng)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTab('cookie')}
            style={[
              styles.tabItem,
              tab === 'cookie' && { backgroundColor: colors.primary },
            ]}
          >
            <Ionicons
              name="code-slash-outline"
              size={16}
              color={tab === 'cookie' ? '#121214' : colors.sub}
            />
            <Text
              style={[
                styles.tabText,
                { color: tab === 'cookie' ? '#121214' : colors.sub },
              ]}
            >
              Dán Cookie
            </Text>
          </Pressable>
        </View>

        {/* Nội dung Tab */}
        {tab === 'direct' ? (
          <View style={styles.webContainer}>
            <View style={[styles.guideBox, { backgroundColor: 'rgba(24, 119, 242, 0.1)', borderColor: 'rgba(24, 119, 242, 0.3)' }]}>
              <Ionicons name="information-circle" size={18} color="#1877F2" />
              <Text style={[styles.guideText, { color: colors.text }]}>
                Đăng nhập tài khoản của bạn trên trang Facebook chính thức bên dưới. App sẽ tự động bắt phiên và lưu nick an toàn.
              </Text>
            </View>

            {loadingWeb && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.sub }]}>Đang tải trang đăng nhập Facebook...</Text>
              </View>
            )}

            <WebView
              ref={webViewRef}
              source={{ uri: 'https://m.facebook.com/login' }}
              injectedJavaScript={generateAutoDetectSessionScript()}
              onMessage={handleWebViewMessage}
              onLoadEnd={() => setLoadingWeb(false)}
              style={styles.webView}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              userAgent={
                Platform.OS === 'ios'
                  ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
                  : 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
              }
            />
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.cookieContainer}>
              <View style={[styles.guideBox, { backgroundColor: 'rgba(255, 208, 0, 0.1)', borderColor: 'rgba(255, 208, 0, 0.3)' }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
                <Text style={[styles.guideText, { color: colors.text }]}>
                  Dán chuỗi Cookie chứa "c_user=" và "xs=" lấy từ trình duyệt máy tính. Phiên đăng nhập được mã hóa an toàn trong máy bạn.
                </Text>
              </View>

              <Text style={[styles.label, { color: colors.text }]}>Tên gợi nhớ (Không bắt buộc):</Text>
              <TextInput
                value={nicknameInput}
                onChangeText={setNicknameInput}
                placeholder="Ví dụ: Nick bán hàng, Nick phụ..."
                placeholderTextColor={colors.sub}
                style={[
                  styles.textInput,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.text },
                ]}
                autoCapitalize="words"
                returnKeyType="next"
              />

              <Text style={[styles.label, { color: colors.text }]}>Chuỗi Cookie Facebook:</Text>
              <TextInput
                value={cookieInput}
                onChangeText={setCookieInput}
                placeholder="c_user=1000...; xs=...; datr=...; sb=..."
                placeholderTextColor={colors.sub}
                multiline
                numberOfLines={5}
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
                <Text style={styles.saveBtnText}>Lưu và Bắt đầu Chat</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 2,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
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
  guideBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  guideText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
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
    marginTop: 14,
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
});
