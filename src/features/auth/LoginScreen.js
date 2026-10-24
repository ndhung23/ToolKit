import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  FlatList,
  Platform,
  Image,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from './AuthContext';
import { useTheme } from '../../theme';
import { useSafeTop } from '../../components/ui';

const FAVICON_ICON = require('../../../assets/favicon1.png');

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const { signIn, signInWithGoogle, sendPasswordReset } = useAuth();
  const safeTop = useSafeTop();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [err, setErr] = useState('');

  // State tính năng Quên mật khẩu
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotErr, setForgotErr] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 phút = 300 giây

  // Bộ đếm ngược thời hạn liên kết 5 phút
  useEffect(() => {
    let timer = null;
    if (forgotModalVisible && forgotSent && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [forgotModalVisible, forgotSent, countdown]);

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const navigateToHome = () => {
    try {
      navigation?.navigate('AppStack', { screen: 'Tabs', params: { screen: 'Home' } });
      return;
    } catch {}
    try {
      navigation?.navigate('Tabs', { screen: 'Home' });
      return;
    } catch {}
    try {
      navigation?.navigate('Home');
    } catch {}
  };

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      await signIn(email.trim(), pw);
      navigateToHome();
    } catch (e) {
      setErr(e?.message || 'Đăng nhập không thành công.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErr('');
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      navigateToHome();
    } catch (e) {
      const msg = e?.message || 'Đăng nhập bằng Google không thành công.';
      setErr(msg);
      Alert.alert('Đăng nhập Google', msg);
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleOpenForgot = () => {
    setForgotEmail(email.trim());
    setForgotErr('');
    setForgotSent(false);
    setCountdown(300);
    setForgotModalVisible(true);
  };

  const handleSendResetEmail = async () => {
    const targetEmail = forgotEmail.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setForgotErr('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    setForgotErr('');
    setForgotBusy(true);
    try {
      await sendPasswordReset(targetEmail);
      setForgotSent(true);
      setCountdown(300);
    } catch (e) {
      let msg = e?.message || 'Không thể gửi email khôi phục.';
      if (e?.code === 'auth/user-not-found') {
        msg = 'Không tìm thấy tài khoản với email này.';
      } else if (e?.code === 'auth/invalid-email') {
        msg = 'Định dạng email không hợp lệ.';
      }
      setForgotErr(msg);
    } finally {
      setForgotBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Nút quay lại nếu đến từ màn hình khác */}
        {navigation?.canGoBack() && (
          <View style={styles.topNavRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={[styles.backBtnPill, { borderColor: colors.border }]}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
              <Text style={[styles.backBtnText, { color: colors.primary }]}>Quay lại</Text>
            </Pressable>
          </View>
        )}
        {/* Logo & Mascot Area */}
        <View style={styles.topSection}>
          <View style={[styles.mascotBadge, { backgroundColor: 'rgba(255, 208, 0, 0.12)' }]}>
            <Image source={FAVICON_ICON} style={styles.mascotImg} resizeMode="contain" />
          </View>
          <Text style={[styles.appName, { color: colors.primary }]}>
            ToolKit <Text style={{ fontSize: 24 }}>✨</Text>
          </Text>
          <Text style={[styles.appTagline, { color: colors.sub }]}>
            Hệ thống tiện ích thông minh cho thiết bị của bạn
          </Text>
        </View>

        {/* Form Container */}
        <View
          style={[
            styles.cardForm,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Text style={[styles.formTitle, { color: colors.text }]}>Đăng nhập</Text>

          <View style={[styles.inputBox, { borderColor: colors.border, backgroundColor: colors.bg }]}>
            <Ionicons name="person-outline" size={20} color={colors.sub} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Tên đăng nhập hoặc Email"
              placeholderTextColor={colors.sub}
              autoCapitalize="none"
              style={[styles.inputField, { color: colors.text }]}
            />
          </View>

          <View style={[styles.inputBox, { borderColor: colors.border, backgroundColor: colors.bg }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.sub} />
            <TextInput
              value={pw}
              onChangeText={setPw}
              placeholder="Mật khẩu"
              placeholderTextColor={colors.sub}
              secureTextEntry={!show}
              style={[styles.inputField, { color: colors.text }]}
            />
            <Pressable onPress={() => setShow(!show)} hitSlop={10}>
              <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.sub} />
            </Pressable>
          </View>

          {/* Nút Quên mật khẩu */}
          <View style={styles.forgotPassRow}>
            <Pressable onPress={handleOpenForgot} hitSlop={8}>
              <Text style={[styles.forgotPassText, { color: colors.primary }]}>Quên mật khẩu?</Text>
            </Pressable>
          </View>

          {!!err && <Text style={[styles.errorText, { color: colors.danger }]}>{err}</Text>}

          {/* Nút Đăng nhập */}
          <Pressable
            onPress={submit}
            disabled={busy || googleBusy}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed || busy ? 0.85 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#121214" />
            ) : (
              <Text style={styles.submitBtnText}>Đăng nhập ngay</Text>
            )}
          </Pressable>

          {/* Đường phân cách */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.sub }]}>HOẶC</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Nút Đăng nhập bằng Google */}
          <Pressable
            onPress={handleGoogleLogin}
            disabled={googleBusy || busy}
            style={({ pressed }) => [
              styles.googleBtn,
              {
                backgroundColor: '#FFFFFF',
                opacity: pressed || googleBusy ? 0.85 : 1,
              },
            ]}
          >
            {googleBusy ? (
              <ActivityIndicator color="#121214" size="small" />
            ) : (
              <View style={styles.googleBtnContent}>
                <Ionicons name="logo-google" size={19} color="#EA4335" />
                <Text style={styles.googleBtnText}>Đăng nhập với Google</Text>
              </View>
            )}
          </Pressable>

          {/* Chuyển sang màn hình Đăng ký */}
          <View style={styles.bottomSwitchRow}>
            <Text style={{ color: colors.sub, fontSize: 14 }}>Chưa có tài khoản? </Text>
            <Pressable onPress={() => navigation?.navigate('Register')} hitSlop={8}>
              <Text style={[styles.switchLink, { color: colors.primary }]}>Đăng ký ngay</Text>
            </Pressable>
          </View>
        </View>
          </>
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingTop: safeTop + 16 }]}
        showsVerticalScrollIndicator={false}
      />

      {/* Modal Quên Mật Khẩu */}
      <Modal
        visible={forgotModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            {!forgotSent ? (
              <>
                <View style={[styles.modalIconCircle, { backgroundColor: 'rgba(255, 208, 0, 0.12)' }]}>
                  <Ionicons name="key-outline" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Quên mật khẩu</Text>
                <Text style={[styles.modalDesc, { color: colors.sub }]}>
                  Nhập địa chỉ email của bạn. Hệ thống sẽ gửi một đường liên kết bảo mật để bạn tạo mật khẩu mới.
                </Text>

                {/* Thông báo thời hạn 5 phút */}
                <View style={styles.expireNoticePill}>
                  <Ionicons name="time-outline" size={15} color="#FFD000" />
                  <Text style={styles.expireNoticeText}>
                    Liên kết xác nhận có hiệu lực trong vòng 5 phút.
                  </Text>
                </View>

                <View style={[styles.inputBox, { borderColor: colors.border, backgroundColor: colors.bg, marginTop: 14 }]}>
                  <Ionicons name="mail-outline" size={20} color={colors.sub} />
                  <TextInput
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    placeholder="Nhập email tài khoản"
                    placeholderTextColor={colors.sub}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={[styles.inputField, { color: colors.text }]}
                  />
                </View>

                {!!forgotErr && <Text style={[styles.errorText, { color: colors.danger }]}>{forgotErr}</Text>}

                <Pressable
                  onPress={handleSendResetEmail}
                  disabled={forgotBusy}
                  style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}
                >
                  {forgotBusy ? (
                    <ActivityIndicator color="#121214" size="small" />
                  ) : (
                    <Text style={styles.modalSubmitBtnText}>Gửi liên kết khôi phục</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => setForgotModalVisible(false)}
                  style={styles.modalCancelBtn}
                  hitSlop={8}
                >
                  <Text style={[styles.modalCancelBtnText, { color: colors.sub }]}>Quay lại</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={[styles.modalIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Ionicons name="checkmark-circle-outline" size={34} color="#10B981" />
                </View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Đã gửi liên kết thành công!</Text>
                <Text style={[styles.modalDesc, { color: colors.sub }]}>
                  Chúng tôi đã gửi đường liên kết đặt lại mật khẩu đến địa chỉ email:
                </Text>
                <Text style={[styles.sentEmailHighlight, { color: colors.primary }]}>{forgotEmail}</Text>

                <View style={styles.instructionBox}>
                  <Text style={[styles.instructionText, { color: colors.sub }]}>
                    Vui lòng mở hòm thư (kể cả mục Thư rác/Spam) và nhấp vào liên kết để thiết lập lại mật khẩu mới.
                  </Text>
                </View>

                {/* Đồng hồ đếm ngược hạn 5 phút */}
                <View
                  style={[
                    styles.countdownCard,
                    {
                      backgroundColor: countdown > 0 ? 'rgba(255, 208, 0, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      borderColor: countdown > 0 ? 'rgba(255, 208, 0, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                    },
                  ]}
                >
                  <Ionicons
                    name={countdown > 0 ? 'hourglass-outline' : 'alert-circle-outline'}
                    size={18}
                    color={countdown > 0 ? '#FFD000' : colors.danger}
                  />
                  <Text
                    style={[
                      styles.countdownText,
                      { color: countdown > 0 ? '#FFD000' : colors.danger },
                    ]}
                  >
                    {countdown > 0
                      ? `Hiệu lực liên kết: ${formatCountdown(countdown)}`
                      : 'Liên kết đã hết hạn (5 phút). Vui lòng gửi lại!'}
                  </Text>
                </View>

                {countdown === 0 ? (
                  <Pressable
                    onPress={handleSendResetEmail}
                    disabled={forgotBusy}
                    style={[styles.modalSubmitBtn, { backgroundColor: colors.primary, marginTop: 14 }]}
                  >
                    {forgotBusy ? (
                      <ActivityIndicator color="#121214" size="small" />
                    ) : (
                      <Text style={styles.modalSubmitBtnText}>Gửi lại liên kết mới</Text>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setForgotModalVisible(false)}
                    style={[styles.modalSubmitBtn, { backgroundColor: colors.primary, marginTop: 14 }]}
                  >
                    <Text style={styles.modalSubmitBtnText}>Đã hiểu / Quay lại đăng nhập</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  mascotBadge: {
    width: 104,
    height: 104,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 208, 0, 0.2)',
  },
  mascotImg: {
    width: 86,
    height: 86,
    borderRadius: 26,
    overflow: 'hidden',
  },
  appName: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 14.5,
    marginTop: 6,
    textAlign: 'center',
  },
  cardForm: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  formTitle: {
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 20,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  inputField: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 10,
    fontSize: 15,
  },
  forgotPassRow: {
    alignItems: 'flex-end',
    marginTop: -4,
    marginBottom: 14,
  },
  forgotPassText: {
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    marginBottom: 12,
    fontSize: 13,
  },
  submitBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#FFD000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#121214',
    fontSize: 16,
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: 12,
    letterSpacing: 0.8,
  },
  googleBtn: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleBtnText: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 12,
  },
  expireNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 208, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 208, 0, 0.25)',
    marginBottom: 6,
  },
  expireNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD000',
  },
  sentEmailHighlight: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  instructionBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 14,
    width: '100%',
  },
  instructionText: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
  },
  countdownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 4,
  },
  countdownText: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalSubmitBtn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  modalSubmitBtnText: {
    color: '#121214',
    fontSize: 15,
    fontWeight: '800',
  },
  modalCancelBtn: {
    marginTop: 14,
    paddingVertical: 6,
  },
  modalCancelBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  topNavRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 208, 0, 0.08)',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  bottomSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  switchLink: {
    fontWeight: '800',
    fontSize: 14,
  },
});
