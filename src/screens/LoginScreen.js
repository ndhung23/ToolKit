import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
  StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { radius, useTheme } from '../theme';
import { useSafeTop } from '../components/ui';

const FAVICON_ICON = require('../../assets/favicon1.png');

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signIn, signInDemo, demoAccounts = [] } = useAuth();
  const safeTop = useSafeTop();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      await signIn(email.trim(), pw);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingTop: safeTop + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & Mascot Area */}
        <View style={styles.topSection}>
          <View style={[styles.mascotBadge, { backgroundColor: 'rgba(255, 208, 0, 0.12)' }]}>
            <Image source={FAVICON_ICON} style={styles.mascotImg} resizeMode="contain" />
          </View>
          <Text style={[styles.appName, { color: colors.primary }]}>
            ToolKit <Text style={{ fontSize: 24 }}>✨</Text>
          </Text>
          <Text style={[styles.appTagline, { color: colors.sub }]}>
            Hệ thống 8 tiện ích thông minh cho thiết bị của bạn
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
            <Ionicons name="mail-outline" size={20} color={colors.sub} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email của bạn"
              placeholderTextColor={colors.sub}
              autoCapitalize="none"
              keyboardType="email-address"
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

          {!!err && <Text style={[styles.errorText, { color: colors.danger }]}>{err}</Text>}

          <Pressable
            onPress={submit}
            disabled={busy}
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
        </View>

        {/* Khu vực đăng nhập nhanh 1-chạm cho môn MMA301 */}
        <View style={styles.demoSection}>
          <Text style={[styles.demoSectionTitle, { color: colors.sub }]}>
            ĐĂNG NHẬP NHANH ĐỂ CHẤM ĐIỂM (1-CHẠM)
          </Text>
          <View style={styles.demoList}>
            {demoAccounts.map((acc) => {
              const isAdm = acc.role === 'admin';
              const isVp = acc.role === 'vip';
              const accentColor = isAdm ? '#EF4444' : isVp ? '#FFD000' : '#9E9EA7';

              return (
                <Pressable
                  key={acc.role}
                  onPress={() => signInDemo(acc)}
                  style={({ pressed }) => [
                    styles.demoCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isAdm
                        ? 'rgba(239, 68, 68, 0.4)'
                        : isVp
                        ? 'rgba(255, 208, 0, 0.4)'
                        : colors.cardBorder,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={[styles.demoIconCircle, { backgroundColor: accentColor + '22' }]}>
                    <Ionicons
                      name={isAdm ? 'shield-checkmark' : isVp ? 'sparkles' : 'person'}
                      size={18}
                      color={accentColor}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.demoCardName, { color: colors.text }]}>{acc.name}</Text>
                    <Text style={[styles.demoCardDesc, { color: colors.sub }]}>{acc.desc}</Text>
                  </View>
                  <View style={[styles.demoRoleTag, { backgroundColor: accentColor + '22' }]}>
                    <Text style={[styles.demoRoleTagText, { color: accentColor }]}>
                      {acc.role.toUpperCase()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.hintText, { color: colors.sub }]}>
          Hoặc nhập email bất kỳ (có chữ 'admin' để nhận quyền Admin, 'vip' để nhận VIP).
        </Text>
      </ScrollView>
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
  errorText: {
    marginBottom: 12,
    fontSize: 13,
  },
  submitBtn: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
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
  hintText: {
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    fontSize: 12.5,
    lineHeight: 18,
  },
  demoSection: {
    marginTop: 24,
  },
  demoSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    textAlign: 'center',
  },
  demoList: {
    gap: 8,
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  demoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  demoCardName: {
    fontSize: 14,
    fontWeight: '700',
  },
  demoCardDesc: {
    fontSize: 11.5,
    marginTop: 2,
  },
  demoRoleTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  demoRoleTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
