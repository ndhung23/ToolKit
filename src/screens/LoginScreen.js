import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { radius, useTheme } from '../theme';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signIn } = useAuth();
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

  const input = {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    marginBottom: 12,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <LinearGradient
          colors={[colors.primary2, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: 300, alignItems: 'center', justifyContent: 'center',
            borderBottomLeftRadius: radius.xl * 1.5,
            borderBottomRightRadius: radius.xl * 1.5,
          }}
        >
          <View
            style={{
              width: 80, height: 80, borderRadius: 24,
              backgroundColor: 'rgba(255,255,255,0.22)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}
          >
            <Ionicons name="apps" size={42} color="#fff" />
          </View>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>My Toolbox</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>
            Tất cả tiện ích trong một ứng dụng
          </Text>
        </LinearGradient>

        <View
          style={{
            marginHorizontal: 20, marginTop: -40, padding: 20,
            backgroundColor: colors.card, borderRadius: radius.xl,
            borderWidth: 1, borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 }}>
            Đăng nhập
          </Text>

          <View style={input}>
            <Ionicons name="mail-outline" size={20} color={colors.sub} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.sub}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ flex: 1, paddingVertical: 14, paddingLeft: 10, color: colors.text }}
            />
          </View>

          <View style={input}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.sub} />
            <TextInput
              value={pw}
              onChangeText={setPw}
              placeholder="Mật khẩu"
              placeholderTextColor={colors.sub}
              secureTextEntry={!show}
              style={{ flex: 1, paddingVertical: 14, paddingLeft: 10, color: colors.text }}
            />
            <Pressable onPress={() => setShow(!show)} hitSlop={10}>
              <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.sub} />
            </Pressable>
          </View>

          {!!err && <Text style={{ color: colors.danger, marginBottom: 12 }}>{err}</Text>}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => ({
              backgroundColor: colors.primary, borderRadius: radius.md,
              paddingVertical: 15, alignItems: 'center', opacity: pressed || busy ? 0.8 : 1,
            })}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Đăng nhập</Text>
            )}
          </Pressable>
        </View>

        <Text style={{ textAlign: 'center', color: colors.sub, marginTop: 20, paddingHorizontal: 30 }}>
          Bản thử nghiệm: nhập email bất kỳ và mật khẩu từ 6 ký tự.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
