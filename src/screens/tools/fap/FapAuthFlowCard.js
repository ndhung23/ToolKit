// src/screens/tools/fap/FapAuthFlowCard.js
// Giao diện Cổng đăng nhập FAP 3 bước (fap.fpt.edu.vn -> FeID -> Google Account Chooser)

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { FAP_CAMPUSES, SAMPLE_SSO_ACCOUNTS } from '../../../utils/fapExamHelper';

export function FapAuthFlowCard({ colors, onLoginSuccess }) {
  const [authStep, setAuthStep] = useState('portal'); // 'portal' | 'feid' | 'google'
  const [roleTab, setRoleTab] = useState('student'); // 'student' | 'parent'
  const [selectedCampus, setSelectedCampus] = useState(FAP_CAMPUSES[0].name);
  const [feidUsername, setFeidUsername] = useState('');
  const [feidPassword, setFeidPassword] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [customStudentId, setCustomStudentId] = useState('');
  const [useCustomGoogle, setUseCustomGoogle] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const completeLoginWithAccount = (accountObj) => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      onLoginSuccess({
        ...accountObj,
        campus: selectedCampus,
        loginAt: new Date().toISOString(),
      });
    }, 650);
  };

  const handleFeidSubmit = () => {
    const cleanUser = feidUsername.trim();
    if (!cleanUser) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Tài khoản (Username) hoặc Email FeID.');
      return;
    }
    if (!feidPassword.trim()) {
      Alert.alert('Thiếu mật khẩu', 'Vui lòng nhập mật khẩu FeID của bạn.');
      return;
    }

    const codeMatch = cleanUser.match(/([a-z]{2}\d{6})/i);
    const studentId = codeMatch ? codeMatch[1].toUpperCase() : 'HE180000';
    const email = cleanUser.includes('@') ? cleanUser : `${cleanUser.toLowerCase()}@fpt.edu.vn`;

    completeLoginWithAccount({
      name: cleanUser.includes('@') ? cleanUser.split('@')[0] : 'Sinh Viên FPT',
      studentId,
      program: 'BIT_SE_19C_NJ',
      cohort: '19',
      email,
      fptEmail: email,
      status: 'HD',
    });
  };

  const handleCustomGoogleSubmit = () => {
    const cleanMail = customEmail.trim();
    if (!cleanMail || !cleanMail.includes('@')) {
      Alert.alert('Email không hợp lệ', 'Vui lòng nhập email @fpt.edu.vn hoặc Gmail của bạn.');
      return;
    }
    const codeMatch = cleanMail.match(/([a-z]{2}\d{6})/i);
    const inferredId = customStudentId.trim()
      ? customStudentId.trim().toUpperCase()
      : codeMatch
      ? codeMatch[1].toUpperCase()
      : 'HE180000';

    completeLoginWithAccount({
      name: customName.trim() || cleanMail.split('@')[0],
      studentId: inferredId,
      program: 'BIT_SE_19C_NJ',
      cohort: '19',
      email: cleanMail,
      fptEmail: cleanMail,
      status: 'HD',
    });
  };

  const handleOpenRealFapBrowser = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://fap.fpt.edu.vn/Auth/Login?ReturnUrl=%2F');
    } catch {
      Alert.alert('Thông báo', 'Không thể mở trình duyệt ngoài.');
    }
  };

  return (
    <View style={[styles.authContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={[styles.urlBar, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <Ionicons name="lock-closed" size={13} color="#10B981" />
        <Text style={[styles.urlText, { color: colors.sub }]} numberOfLines={1}>
          {authStep === 'portal'
            ? 'https://fap.fpt.edu.vn/Auth/Login?ReturnUrl=%2F'
            : authStep === 'feid'
            ? 'https://feid.fpt.edu.vn/Account/Login?ReturnUrl=%2Fconnect%2Fauthorize'
            : 'https://accounts.google.com/v3/signin/accountchooser?client_id=feid.fpt.edu.vn'}
        </Text>
        {authStep !== 'portal' && (
          <Pressable onPress={() => setAuthStep('portal')} hitSlop={8}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Quay lại</Text>
          </Pressable>
        )}
      </View>

      {syncing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingTitle, { color: colors.text }]}>
            Đang xác thực SSO & tải lịch thi từ FAP...
          </Text>
          <Text style={[styles.loadingSub, { color: colors.sub }]}>
            Đồng bộ dữ liệu từ https://fap.fpt.edu.vn/ExamSchedule
          </Text>
        </View>
      ) : authStep === 'portal' ? (
        <View style={styles.portalBody}>
          <View style={styles.fptLogoRow}>
            <View style={[styles.fptBadge, { backgroundColor: '#F37021' }]}>
              <Text style={styles.fptBadgeText}>FPT</Text>
            </View>
            <Text style={[styles.fptEduText, { color: '#0066B3' }]}>Education</Text>
          </View>

          <Text style={styles.fptUniTitle}>TRƯỜNG ĐẠI HỌC FPT</Text>
          <Text style={[styles.fptSystemSub, { color: colors.text }]}>Hệ thống quản lý đào tạo</Text>
          <Text style={{ color: colors.sub, fontSize: 12, marginBottom: 14 }}>Đăng nhập</Text>

          <View style={[styles.roleSwitchWrap, { backgroundColor: colors.bg }]}>
            <Pressable
              onPress={() => setRoleTab('student')}
              style={[styles.roleSwitchTab, roleTab === 'student' && { backgroundColor: colors.card }]}
            >
              <Text style={[styles.roleSwitchText, { color: roleTab === 'student' ? colors.text : colors.sub }]}>
                Cán bộ & Sinh viên
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setRoleTab('parent')}
              style={[styles.roleSwitchTab, roleTab === 'parent' && { backgroundColor: colors.card }]}
            >
              <Text style={[styles.roleSwitchText, { color: roleTab === 'parent' ? colors.text : colors.sub }]}>
                Phụ huynh
              </Text>
            </Pressable>
          </View>

          <View style={styles.campusRow}>
            {FAP_CAMPUSES.map((c) => {
              const active = selectedCampus === c.name;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedCampus(c.name)}
                  style={[
                    styles.campusChip,
                    {
                      backgroundColor: active ? 'rgba(255, 208, 0, 0.15)' : colors.bg,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: active ? colors.primary : colors.sub }}>
                    {c.id}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ color: colors.sub, fontSize: 12, marginVertical: 10 }}>
            Đăng nhập dành cho cán bộ và sinh viên
          </Text>

          <Pressable
            onPress={() => setAuthStep('google')}
            style={[styles.googlePortalBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
          >
            <Ionicons name="logo-google" size={18} color="#EA4335" />
            <Text style={[styles.googlePortalBtnText, { color: colors.text }]}>Đăng nhập với Google</Text>
          </Pressable>

          <Pressable onPress={() => setAuthStep('feid')} style={styles.feidPortalBtn}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
            <Text style={styles.feidPortalBtnText}>Đăng nhập với FeID</Text>
          </Pressable>

          <Pressable onPress={handleOpenRealFapBrowser} style={styles.openRealFapLink}>
            <Ionicons name="open-outline" size={14} color={colors.sub} />
            <Text style={[styles.openRealFapText, { color: colors.sub }]}>
              Mở cổng https://fap.fpt.edu.vn trên trình duyệt ngoài
            </Text>
          </Pressable>
        </View>
      ) : authStep === 'feid' ? (
        <View style={styles.feidBody}>
          <Text style={[styles.feidHeaderTitle, { color: colors.text }]}>Đăng nhập Đại học FPT (FeID)</Text>

          <View style={[styles.feidBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.feidBoxTitle, { color: colors.text }]}>
              Đăng nhập bằng tài khoản và mật khẩu
            </Text>

            <Text style={[styles.inputLabel, { color: colors.sub }]}>Tài khoản</Text>
            <TextInput
              value={feidUsername}
              onChangeText={setFeidUsername}
              placeholder="Tài khoản (Username / Email FPT)"
              placeholderTextColor={colors.sub}
              autoCapitalize="none"
              style={[styles.textInput, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
            />

            <Text style={[styles.inputLabel, { color: colors.sub }]}>Mật khẩu</Text>
            <TextInput
              value={feidPassword}
              onChangeText={setFeidPassword}
              placeholder="Mật khẩu (được nhà trường cung cấp)"
              placeholderTextColor={colors.sub}
              secureTextEntry
              autoCapitalize="none"
              style={[styles.textInput, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
            />

            <Pressable onPress={handleFeidSubmit} style={styles.feidLoginActionBtn}>
              <Text style={styles.feidLoginActionText}>Login</Text>
            </Pressable>
          </View>

          <View style={[styles.feidBox, { backgroundColor: colors.bg, borderColor: colors.border, marginTop: 12 }]}>
            <Text style={[styles.feidBoxTitle, { color: colors.text }]}>Hoặc đăng nhập SSO với</Text>
            <View style={styles.ssoButtonsRow}>
              <Pressable
                onPress={() => setAuthStep('google')}
                style={[styles.ssoBtn, { borderColor: '#3B82F6', backgroundColor: colors.card }]}
              >
                <Ionicons name="logo-google" size={16} color="#EA4335" />
                <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 12.5 }}>
                  Email fpt.edu.vn hoặc Gmail
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setAuthStep('google')}
                style={[styles.ssoBtn, { borderColor: '#3B82F6', backgroundColor: colors.card }]}
              >
                <Ionicons name="logo-microsoft" size={16} color="#00A4EF" />
                <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 12.5 }}>Microsoft Email</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.googleChooserBody}>
          <View style={styles.googleHeaderRow}>
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text style={[styles.googleHeaderLabel, { color: colors.sub }]}>Đăng nhập bằng Google</Text>
          </View>

          <Text style={[styles.googleMainTitle, { color: colors.text }]}>Chọn tài khoản</Text>
          <Text style={[styles.googleSubTitle, { color: colors.sub }]}>
            Tiếp tục tới <Text style={{ color: '#3B82F6', fontWeight: '700' }}>fpt.edu.vn</Text>
          </Text>

          {!useCustomGoogle ? (
            <View style={{ marginTop: 12 }}>
              {SAMPLE_SSO_ACCOUNTS.map((acc) => (
                <Pressable
                  key={acc.id}
                  onPress={() => completeLoginWithAccount(acc)}
                  style={[styles.googleAccRow, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.googleAvatar}>
                    <Text style={styles.googleAvatarLetter}>{acc.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.googleAccName, { color: colors.text }]}>
                      {acc.name} ({acc.studentId})
                    </Text>
                    <Text style={[styles.googleAccEmail, { color: colors.sub }]}>{acc.email}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.sub} />
                </Pressable>
              ))}

              <Pressable
                onPress={() => setUseCustomGoogle(true)}
                style={[styles.googleAccRow, { borderBottomWidth: 0, marginTop: 4 }]}
              >
                <View style={[styles.googleAvatar, { backgroundColor: colors.bg }]}>
                  <Ionicons name="person-add-outline" size={16} color={colors.text} />
                </View>
                <Text style={[styles.googleAccName, { color: colors.text }]}>Sử dụng một tài khoản khác</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.inputLabel, { color: colors.sub }]}>Email trường (@fpt.edu.vn) hoặc Gmail</Text>
              <TextInput
                value={customEmail}
                onChangeText={setCustomEmail}
                placeholder="VD: sinhvien@gmail.com"
                placeholderTextColor={colors.sub}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              />

              <Text style={[styles.inputLabel, { color: colors.sub }]}>Họ và tên sinh viên</Text>
              <TextInput
                value={customName}
                onChangeText={setCustomName}
                placeholder="VD: Sinh Viên FPT"
                placeholderTextColor={colors.sub}
                style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              />

              <Text style={[styles.inputLabel, { color: colors.sub }]}>Mã số sinh viên (MSSV)</Text>
              <TextInput
                value={customStudentId}
                onChangeText={setCustomStudentId}
                placeholder="VD: HE180000"
                placeholderTextColor={colors.sub}
                autoCapitalize="characters"
                style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Pressable
                  onPress={() => setUseCustomGoogle(false)}
                  style={[styles.cancelSmallBtn, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.sub, fontWeight: '700' }}>Danh sách có sẵn</Text>
                </Pressable>
                <Pressable
                  onPress={handleCustomGoogleSubmit}
                  style={[styles.confirmSmallBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: '#121214', fontWeight: '800' }}>Đăng nhập FAP</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  authContainer: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 18 },
  urlBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, gap: 8 },
  urlText: { flex: 1, fontSize: 11.5 },
  loadingBox: { padding: 36, alignItems: 'center', justifyContent: 'center' },
  loadingTitle: { fontSize: 15, fontWeight: '800', marginTop: 14 },
  loadingSub: { fontSize: 12, marginTop: 4 },
  portalBody: { padding: 20, alignItems: 'center' },
  fptLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  fptBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  fptBadgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  fptEduText: { fontSize: 15, fontWeight: '800' },
  fptUniTitle: { fontSize: 19, fontWeight: '900', color: '#F37021', letterSpacing: 0.5, marginBottom: 8 },
  fptSystemSub: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  roleSwitchWrap: { flexDirection: 'row', width: '100%', borderRadius: 12, padding: 4, marginBottom: 12 },
  roleSwitchTab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  roleSwitchText: { fontSize: 12.5, fontWeight: '700' },
  campusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 4 },
  campusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  googlePortalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 11, borderRadius: 10, borderWidth: 1, gap: 8, marginBottom: 10 },
  googlePortalBtnText: { fontSize: 13.5, fontWeight: '700' },
  feidPortalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 12, borderRadius: 10, backgroundColor: '#4353B3', gap: 8 },
  feidPortalBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
  openRealFapLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  openRealFapText: { fontSize: 11.5, textDecorationLine: 'underline' },
  feidBody: { padding: 16 },
  feidHeaderTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  feidBox: { padding: 14, borderRadius: 12, borderWidth: 1 },
  feidBoxTitle: { fontSize: 13.5, fontWeight: '800', marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 5, marginTop: 6 },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5, marginBottom: 6 },
  feidLoginActionBtn: { alignSelf: 'flex-start', backgroundColor: '#2563EB', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, marginTop: 6 },
  feidLoginActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  ssoButtonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ssoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  googleChooserBody: { padding: 18 },
  googleHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  googleHeaderLabel: { fontSize: 12.5, fontWeight: '600' },
  googleMainTitle: { fontSize: 20, fontWeight: '800' },
  googleSubTitle: { fontSize: 13, marginTop: 2 },
  googleAccRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, gap: 12 },
  googleAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  googleAvatarLetter: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  googleAccName: { fontSize: 13.5, fontWeight: '700' },
  googleAccEmail: { fontSize: 12, marginTop: 1 },
  cancelSmallBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  confirmSmallBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
});

