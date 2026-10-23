// src/screens/tools/FapExamScreen.js
// Tiện ích: Đăng nhập cổng FAP (fap.fpt.edu.vn) -> Tự động lấy Lịch thi -> Nhắc nhở trước giờ thi

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Switch,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';
import * as SecureStore from '../../utils/storage';
import {
  INITIAL_FAP_EXAMS,
  REMINDER_PRESETS,
  getExamTimeStatus,
  triggerExamNotification,
} from '../../utils/fapExamHelper';
import { FapAuthFlowCard, FapExamFormModal, FapRealWebViewModal } from './fap/FapLoginModals';

const STORAGE_FAP_SESSION = 'toolkit_fap_student_session_v1';
const STORAGE_FAP_EXAMS = 'toolkit_fap_exam_list_v1';
const STORAGE_FAP_REMINDER_MINS = 'toolkit_fap_reminder_mins_v1';

export default function FapExamScreen({ navigation }) {
  const { colors } = useTheme();

  const [fapUser, setFapUser] = useState(null);
  const [exams, setExams] = useState([]);
  const [realWebViewVisible, setRealWebViewVisible] = useState(false);
  const [defaultReminderMins, setDefaultReminderMins] = useState(30);
  const [customMinsInput, setCustomMinsInput] = useState('30');
  const [syncingSchedule, setSyncingSchedule] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const examsRef = useRef(exams);
  examsRef.current = exams;
  const defaultMinsRef = useRef(defaultReminderMins);
  defaultMinsRef.current = defaultReminderMins;

  // 1. Khôi phục phiên đăng nhập FAP, lịch thi & cấu hình thời gian nhắc từ bộ nhớ
  useEffect(() => {
    (async () => {
      try {
        const [savedSession, savedExams, savedMins] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_FAP_SESSION),
          SecureStore.getItemAsync(STORAGE_FAP_EXAMS),
          SecureStore.getItemAsync(STORAGE_FAP_REMINDER_MINS),
        ]);

        if (savedSession) {
          setFapUser(JSON.parse(savedSession));
        }
        if (savedExams) {
          const parsedExams = JSON.parse(savedExams);
          if (Array.isArray(parsedExams) && parsedExams.length > 0) {
            setExams(parsedExams);
          }
        }
        if (savedMins) {
          const minsNum = parseInt(savedMins, 10);
          if (!isNaN(minsNum) && minsNum > 0) {
            setDefaultReminderMins(minsNum);
            setCustomMinsInput(String(minsNum));
          }
        }
      } catch (e) {
        console.warn('[FAP Exam] Lỗi đọc dữ liệu lưu trữ:', e);
      }
    })();
  }, []);

  // 2. Bộ đếm thời gian thực mỗi giây để cập nhật Countdown & kích hoạt thông báo khi đến giờ nhắc
  useEffect(() => {
    const timer = setInterval(() => {
      const currentTick = new Date();
      setNow(currentTick);

      // Chỉ kiểm tra nhắc nhở khi người dùng đã đăng nhập FAP
      if (!fapUser) return;

      let hasTriggeredChange = false;
      const updatedList = examsRef.current.map((exam) => {
        if (!exam.reminderEnabled || exam.notified) return exam;

        const status = getExamTimeStatus(exam, defaultMinsRef.current, currentTick);
        if (status.valid && status.isReminderReached) {
          hasTriggeredChange = true;
          triggerExamNotification(exam, status.reminderMins);
          return { ...exam, notified: true };
        }
        return exam;
      });

      if (hasTriggeredChange) {
        setExams(updatedList);
        SecureStore.setItemAsync(STORAGE_FAP_EXAMS, JSON.stringify(updatedList));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [fapUser]);

  const persistExams = async (nextList) => {
    setExams(nextList);
    await SecureStore.setItemAsync(STORAGE_FAP_EXAMS, JSON.stringify(nextList));
  };

  // Xử lý khi đăng nhập FAP thành công -> tự động lấy lịch thi
  const handleLoginSuccess = async (accountData) => {
    setFapUser(accountData);
    await SecureStore.setItemAsync(STORAGE_FAP_SESSION, JSON.stringify(accountData));

    // Tự động nạp lịch thi FAP nếu danh sách đang trống
    if (!exams || exams.length === 0) {
      await persistExams(INITIAL_FAP_EXAMS);
    }

    Alert.alert(
      'Đăng nhập FAP thành công! 🎉',
      `Xin chào ${accountData.name} (${accountData.studentId}).\nHệ thống đã tự động tải ${
        exams.length || INITIAL_FAP_EXAMS.length
      } lịch thi từ cổng fap.fpt.edu.vn/ExamSchedule và kích hoạt chế độ nhắc nhở.`
    );
  };

  // Đồng bộ thành công dữ liệu THẬT 100% từ WebView / Cổng Bridge
  const handleRealSyncSuccess = async (userData, examList) => {
    setFapUser(userData);
    setExams(examList);
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_FAP_SESSION, JSON.stringify(userData)),
      SecureStore.setItemAsync(STORAGE_FAP_EXAMS, JSON.stringify(examList)),
    ]);
  };

  // Đăng xuất tài khoản FAP
  const handleLogoutFap = () => {
    const doLogout = async () => {
      setFapUser(null);
      setExams([]);
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_FAP_SESSION),
        SecureStore.deleteItemAsync(STORAGE_FAP_EXAMS),
      ]);
    };

    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined'
        ? window.confirm('Đăng xuất tài khoản FAP\nBạn có muốn thoát phiên FAP hiện tại để sinh viên khác đăng nhập?')
        : true;
      if (ok) doLogout();
      return;
    }

    Alert.alert(
      'Đăng xuất tài khoản FAP',
      'Bạn có muốn thoát tài khoản FAP hiện tại để sinh viên khác đăng nhập?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: doLogout },
      ]
    );
  };

  // Đồng bộ lại lịch thi từ FAP
  const handleResyncFapSchedule = () => {
    if (Platform.OS !== 'web') {
      setRealWebViewVisible(true);
    } else {
      setModalVisible(true);
    }
  };

  // Chọn mốc thời gian nhắc nhở mặc định
  const handleSelectPresetMins = async (mins) => {
    setDefaultReminderMins(mins);
    setCustomMinsInput(String(mins));
    await SecureStore.setItemAsync(STORAGE_FAP_REMINDER_MINS, String(mins));

    // Reset cờ notified để áp dụng mốc giờ nhắc mới
    const resetList = exams.map((e) => ({ ...e, notified: false }));
    await persistExams(resetList);
  };

  // Lưu số phút nhắc nhở do người dùng tự nhập
  const handleApplyCustomMins = async () => {
    const parsed = parseInt(customMinsInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      Alert.alert('Số phút không hợp lệ', 'Vui lòng nhập số phút lớn hơn hoặc bằng 1.');
      return;
    }
    await handleSelectPresetMins(parsed);
    Alert.alert(
      'Đã lưu thời gian nhắc',
      `Hệ thống sẽ tự động nhắc nhở trước giờ thi ${parsed} phút cho các môn thi.`
    );
  };

  // Bật / tắt nhắc nhở cho từng môn thi
  const toggleExamReminder = async (examId) => {
    const nextList = exams.map((e) =>
      e.id === examId ? { ...e, reminderEnabled: !e.reminderEnabled, notified: false } : e
    );
    await persistExams(nextList);
  };

  // Thêm hoặc cập nhật 1 môn thi
  const handleSaveExamItem = async (examData) => {
    const exists = exams.some((e) => e.id === examData.id);
    const nextList = exists
      ? exams.map((e) => (e.id === examData.id ? examData : e))
      : [examData, ...exams];
    await persistExams(nextList);
  };

  // Nhập hàng loạt môn thi từ dữ liệu copy bảng FAP
  const handleImportExams = async (importedList, importedUser) => {
    if (importedUser && (!fapUser || fapUser.studentId !== importedUser.studentId)) {
      setFapUser(importedUser);
      await SecureStore.setItemAsync(STORAGE_FAP_SESSION, JSON.stringify(importedUser));
    }
    const existingKeys = new Set(exams.map((e) => `${e.subjectCode}_${e.date}_${e.time}`));
    const newItems = importedList.filter((e) => !existingKeys.has(`${e.subjectCode}_${e.date}_${e.time}`));
    const nextList = [...newItems, ...exams];
    await persistExams(nextList);
    Alert.alert(
      'Nhập lịch thi thành công ✅',
      `Đã bóc tách và nạp ${importedList.length} ca thi thực tế từ cổng FAP của ${importedUser?.name || fapUser?.name || 'bạn'}:\n${importedList.map((e) => `• ${e.subjectCode} (${e.time} ngày ${e.date})`).join('\n')}`
    );
  };

  // Xóa 1 môn thi khỏi danh sách
  const handleDeleteExam = (exam) => {
    Alert.alert('Xóa lịch thi', `Bạn có chắc muốn xóa lịch thi môn ${exam.subjectCode}?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          const nextList = exams.filter((e) => e.id !== exam.id);
          await persistExams(nextList);
        },
      },
    ]);
  };

  const openFapExamWebPage = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://fap.fpt.edu.vn/ExamSchedule');
    } catch {}
  };

  const renderExamItem = ({ item }) => {
    const status = getExamTimeStatus(item, defaultReminderMins, now);
    const isPE = item.examType?.toUpperCase() === 'PE';

    return (
      <View
        style={[
          styles.examCard,
          {
            backgroundColor: colors.card,
            borderColor: status.isReminderReached ? colors.primary : colors.cardBorder,
          },
        ]}
      >
        {/* Hàng trên: Mã môn + Loại thi (PE/FE) + Switch bật/tắt nhắc nhở */}
        <View style={styles.examTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <View
              style={[
                styles.examTypeBadge,
                {
                  backgroundColor: isPE ? 'rgba(245, 158, 11, 0.16)' : 'rgba(59, 130, 246, 0.16)',
                  borderColor: isPE ? '#F59E0B' : '#3B82F6',
                },
              ]}
            >
              <Text
                style={{
                  color: isPE ? '#F59E0B' : '#3B82F6',
                  fontWeight: '900',
                  fontSize: 11.5,
                }}
              >
                {item.examType || 'PE'}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.subjectCodeText, { color: colors.text }]}>
                {item.subjectCode}
              </Text>
              <Text style={[styles.subjectNameText, { color: colors.sub }]} numberOfLines={2}>
                {item.subjectName}
              </Text>
            </View>
          </View>

          <Switch
            value={Boolean(item.reminderEnabled)}
            onValueChange={() => toggleExamReminder(item.id)}
            trackColor={{ false: '#3E3E42', true: colors.primary }}
            thumbColor={item.reminderEnabled ? '#121214' : '#9E9EA7'}
          />
        </View>

        {/* Bảng chi tiết Ngày - Giờ - Phòng - Hình thức thi chuẩn FAP */}
        <View style={[styles.examMetaGrid, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <View style={styles.metaCell}>
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={[styles.metaLabel, { color: colors.sub }]}>Ngày thi:</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>{item.date}</Text>
          </View>

          <View style={styles.metaCell}>
            <Ionicons name="time-outline" size={14} color="#10B981" />
            <Text style={[styles.metaLabel, { color: colors.sub }]}>Thời gian:</Text>
            <Text style={[styles.metaValue, { color: '#10B981' }]}>{item.time}</Text>
          </View>

          <View style={styles.metaCell}>
            <Ionicons name="location-outline" size={14} color="#F59E0B" />
            <Text style={[styles.metaLabel, { color: colors.sub }]}>Phòng thi:</Text>
            <Text style={[styles.metaValue, { color: '#F59E0B' }]}>{item.room}</Text>
          </View>

          <View style={styles.metaCell}>
            <Ionicons name="desktop-outline" size={14} color="#3B82F6" />
            <Text style={[styles.metaLabel, { color: colors.sub }]}>Hình thức:</Text>
            <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
              {item.examForm}
            </Text>
          </View>
        </View>

        {/* Khung trạng thái Đếm ngược & Mốc giờ báo nhắc nhở */}
        <View
          style={[
            styles.countdownBanner,
            {
              backgroundColor: status.isReminderReached
                ? 'rgba(255, 208, 0, 0.16)'
                : item.reminderEnabled
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(158, 158, 167, 0.08)',
              borderColor: status.isReminderReached
                ? colors.primary
                : item.reminderEnabled
                ? 'rgba(16, 185, 129, 0.3)'
                : colors.border,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={item.reminderEnabled ? 'notifications' : 'notifications-off-outline'}
                size={15}
                color={
                  status.isReminderReached
                    ? colors.primary
                    : item.reminderEnabled
                    ? '#10B981'
                    : colors.sub
                }
              />
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '800',
                  color: status.isReminderReached
                    ? colors.primary
                    : item.reminderEnabled
                    ? '#10B981'
                    : colors.sub,
                }}
              >
                {status.countdownText}
              </Text>
            </View>
            <Text style={{ fontSize: 11.5, color: colors.sub, marginTop: 3 }}>
              {item.reminderEnabled
                ? `Hẹn nhắc trước ${status.reminderMins} phút (${status.reminderTimeText})`
                : 'Đã tắt nhắc nhở cho môn thi này'}
            </Text>
          </View>

          {item.customReminderMinutes !== null && item.customReminderMinutes !== undefined && (
            <View style={[styles.customPill, { backgroundColor: 'rgba(255, 208, 0, 0.18)' }]}>
              <Text style={{ color: colors.primary, fontSize: 10.5, fontWeight: '800' }}>
                Riêng: {item.customReminderMinutes}p
              </Text>
            </View>
          )}
        </View>

        {/* Hàng nút hành động: Test thông báo / Chỉnh sửa / Xóa */}
        <View style={styles.examActionsRow}>
          <Pressable
            onPress={() => triggerExamNotification(item, status.reminderMins)}
            style={[styles.actionBtn, { backgroundColor: 'rgba(255, 208, 0, 0.14)', borderColor: colors.primary }]}
          >
            <Ionicons name="volume-high-outline" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
              Test nhắc ngay
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setEditingExam(item);
              setModalVisible(true);
            }}
            style={[styles.actionBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
          >
            <Ionicons name="options-outline" size={14} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
              Chỉnh giờ / Nhắc
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleDeleteExam(item)}
            style={[styles.iconOnlyBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
          >
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Nhắc nhở lịch thi FAP"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Pressable
              onPress={() => setRealWebViewVisible(true)}
              style={[styles.headerAddBtn, { backgroundColor: '#2563EB' }]}
              hitSlop={8}
            >
              <Ionicons name="globe-outline" size={17} color="#FFFFFF" />
            </Pressable>
            {fapUser ? (
              <Pressable
                onPress={() => {
                  setEditingExam(null);
                  setModalVisible(true);
                }}
                style={[styles.headerAddBtn, { backgroundColor: colors.primary }]}
                hitSlop={8}
              >
                <Ionicons name="add" size={18} color="#121214" />
              </Pressable>
            ) : null}
          </View>
        }
      />

      <FlatList
        data={fapUser ? exams : []}
        keyExtractor={(item) => item.id}
        renderItem={renderExamItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          !fapUser ? (
            <>
              {/* Banner Mở WebView FAP thật */}
              <Pressable
                onPress={() => setRealWebViewVisible(true)}
                style={styles.realFapBanner}
              >
                <View style={styles.realFapIconCircle}>
                  <Ionicons name="globe" size={24} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 14.5 }}>
                      Đăng nhập Cổng FAP Thật (WebView)
                    </Text>
                    <View style={styles.realBadge}>
                      <Text style={styles.realBadgeText}>REAL LIVE</Text>
                    </View>
                  </View>
                  <Text style={{ color: '#BFDBFE', fontSize: 12, marginTop: 3 }}>
                    Mở trực tiếp fap.fpt.edu.vn, đăng nhập Google trường & cào tự động 100% lịch thi của bạn.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </Pressable>

              {/* Hướng dẫn quy trình 4 bước */}
              <View style={[styles.introBanner, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.introIconWrap}>
                  <Ionicons name="school" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.introTitle, { color: colors.text }]}>
                    Đồng bộ Lịch thi Đại học FPT (FAP)
                  </Text>
                  <Text style={[styles.introDesc, { color: colors.sub }]}>
                    Đăng nhập bằng tài khoản FeID hoặc Email trường (@fpt.edu.vn / Gmail) để tự động lấy lịch thi và hẹn giờ nhắc nhở.
                  </Text>
                </View>
              </View>

              {/* Giao diện Cổng đăng nhập FAP 3 bước chuẩn theo ảnh */}
              <FapAuthFlowCard colors={colors} onLoginSuccess={handleLoginSuccess} />
            </>
          ) : (
            <>
              {/* 1. THẺ THÔNG TIN SINH VIÊN FAP (Giống ảnh 4 trên fap.fpt.edu.vn) */}
              <View style={styles.studentBanner}>
                <View style={styles.studentTopRow}>
                  <View style={styles.studentCapCircle}>
                    <Ionicons name="school-outline" size={26} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.studentLabelSmall}>THÔNG TIN SINH VIÊN • {fapUser.campus}</Text>
                    <Text style={styles.studentFullName}>{fapUser.name}</Text>
                    <Text style={styles.studentCodeSub}>{fapUser.studentId}</Text>
                  </View>
                  <Pressable onPress={handleLogoutFap} style={styles.logoutFapBtn} hitSlop={8}>
                    <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.logoutFapText}>Đổi TK</Text>
                  </Pressable>
                </View>

                <View style={styles.studentMetaBadgesRow}>
                  <View style={styles.studentMetaChip}>
                    <Text style={styles.studentMetaChipLabel}>Trạng thái</Text>
                    <Text style={styles.studentMetaChipVal}>{fapUser.status || 'HD'}</Text>
                  </View>
                  <View style={styles.studentMetaChip}>
                    <Text style={styles.studentMetaChipLabel}>Mã chương trình</Text>
                    <Text style={styles.studentMetaChipVal}>{fapUser.program || 'BIT_SE_19C_NJ'}</Text>
                  </View>
                  <View style={styles.studentMetaChip}>
                    <Text style={styles.studentMetaChipLabel}>Khóa</Text>
                    <Text style={styles.studentMetaChipVal}>{fapUser.cohort || '19'}</Text>
                  </View>
                </View>

                <View style={styles.studentSyncActions}>
                  <Pressable
                    onPress={() => setRealWebViewVisible(true)}
                    style={[styles.syncFapBtn, { backgroundColor: '#2563EB', flex: 1.1 }]}
                  >
                    <Ionicons name="globe-outline" size={15} color="#FFFFFF" />
                    <Text style={[styles.syncFapBtnText, { color: '#FFFFFF' }]}>Cào lại WebView</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleResyncFapSchedule}
                    disabled={syncingSchedule}
                    style={styles.syncFapBtn}
                  >
                    {syncingSchedule ? (
                      <ActivityIndicator size="small" color="#1E3A8A" />
                    ) : (
                      <>
                        <Ionicons name="sync" size={15} color="#1E3A8A" />
                        <Text style={styles.syncFapBtnText}>Làm mới</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable onPress={openFapExamWebPage} style={styles.openWebFapBtn}>
                    <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.openWebFapText}>Web FAP</Text>
                  </Pressable>
                </View>
              </View>

              {/* 2. CẤU HÌNH THỜI GIAN NHẮC NHỞ TRƯỚC GIỜ THI (Người dùng tự chỉnh) */}
              <View style={[styles.reminderConfigCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.configHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="alarm-outline" size={20} color={colors.primary} />
                    <Text style={[styles.configTitle, { color: colors.text }]}>
                      Thời gian nhắc nhở trước giờ thi
                    </Text>
                  </View>
                  <View style={[styles.activeMinsPill, { backgroundColor: 'rgba(255, 208, 0, 0.15)' }]}>
                    <Text style={{ color: colors.primary, fontSize: 11.5, fontWeight: '800' }}>
                      Trước {defaultReminderMins} phút
                    </Text>
                  </View>
                </View>

                <Text style={[styles.configSub, { color: colors.sub }]}>
                  Chọn nhanh mốc thời gian hoặc tự nhập số phút bạn muốn hệ thống báo chuông trước khi vào phòng thi:
                </Text>

                {/* Hàng nút chọn nhanh (Presets) */}
                <View style={styles.presetRow}>
                  {REMINDER_PRESETS.map((p) => {
                    const selected = defaultReminderMins === p.minutes;
                    return (
                      <Pressable
                        key={p.minutes}
                        onPress={() => handleSelectPresetMins(p.minutes)}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: selected ? colors.primary : colors.bg,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: selected ? '#121214' : colors.text,
                          }}
                        >
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Ô tự nhập số phút tùy chỉnh */}
                <View style={styles.customInputRow}>
                  <TextInput
                    value={customMinsInput}
                    onChangeText={setCustomMinsInput}
                    keyboardType="numeric"
                    placeholder="Nhập số phút (VD: 45)"
                    placeholderTextColor={colors.sub}
                    style={[
                      styles.customMinsInput,
                      { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border },
                    ]}
                  />
                  <Pressable
                    onPress={handleApplyCustomMins}
                    style={[styles.applyMinsBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={styles.applyMinsBtnText}>Lưu mốc nhắc</Text>
                  </Pressable>
                </View>
              </View>

              {/* 3. TIÊU ĐỀ BẢNG LỊCH THI CỦA TÔI */}
              <View style={styles.scheduleHeaderRow}>
                <View>
                  <Text style={[styles.scheduleTitle, { color: colors.text }]}>
                    Lịch thi của tôi ({exams.length})
                  </Text>
                  <Text style={{ color: colors.sub, fontSize: 12 }}>
                    Tự động đồng bộ từ cổng đào tạo FAP
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    setEditingExam(null);
                    setModalVisible(true);
                  }}
                  style={[styles.addScheduleBtn, { backgroundColor: colors.card, borderColor: colors.primary }]}
                >
                  <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: '800' }}>
                    Thêm / Dán lịch FAP
                  </Text>
                </Pressable>
              </View>
            </>
          )
        }
        ListEmptyComponent={
          fapUser ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="calendar-clear-outline" size={36} color={colors.sub} />
              <Text style={{ color: colors.text, fontWeight: '700', marginTop: 10 }}>
                Chưa có lịch thi nào
              </Text>
              <Text style={{ color: colors.sub, fontSize: 12.5, marginTop: 4, textAlign: 'center' }}>
                Nhấn "Tự động lấy lại lịch thi" hoặc "Thêm / Dán lịch FAP" để cập nhật.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 60 }} />}
      />

      {/* Modal Thêm / Chỉnh sửa / Dán lịch thi FAP */}
      <FapExamFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        colors={colors}
        editingExam={editingExam}
        onSaveExam={handleSaveExamItem}
        onImportExams={handleImportExams}
      />

      {/* Modal WebView kết nối Cổng FAP thật 100% */}
      <FapRealWebViewModal
        visible={realWebViewVisible}
        onClose={() => setRealWebViewVisible(false)}
        colors={colors}
        onSyncSuccess={handleRealSyncSuccess}
        onOpenPasteModal={() => setModalVisible(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingTop: 8 },
  realFapBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 12, gap: 12, backgroundColor: '#1E40AF' },
  realFapIconCircle: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  realBadge: { backgroundColor: '#22C55E', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  realBadgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  headerAddBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  introBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 14, gap: 12 },
  introIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255, 208, 0, 0.14)', alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontSize: 14.5, fontWeight: '800', marginBottom: 3 },
  introDesc: { fontSize: 12, lineHeight: 17 },
  studentBanner: { backgroundColor: '#1E40AF', borderRadius: 20, padding: 16, marginBottom: 16 },
  studentTopRow: { flexDirection: 'row', alignItems: 'center' },
  studentCapCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  studentLabelSmall: { color: 'rgba(255,255,255,0.75)', fontSize: 10.5, fontWeight: '700' },
  studentFullName: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginTop: 2 },
  studentCodeSub: { color: '#93C5FD', fontSize: 13, fontWeight: '700' },
  logoutFapBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  logoutFapText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },
  studentMetaBadgesRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  studentMetaChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  studentMetaChipLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5 },
  studentMetaChipVal: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800', marginTop: 2 },
  studentSyncActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  syncFapBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingVertical: 9, borderRadius: 10 },
  syncFapBtnText: { color: '#1E3A8A', fontSize: 12, fontWeight: '800' },
  openWebFapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  openWebFapText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },
  reminderConfigCard: { borderRadius: 18, borderWidth: 1, padding: 15, marginBottom: 16 },
  configHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  configTitle: { fontSize: 14.5, fontWeight: '800' },
  activeMinsPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  configSub: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  presetChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 9, borderWidth: 1 },
  customInputRow: { flexDirection: 'row', gap: 8 },
  customMinsInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 40, fontSize: 13 },
  applyMinsBtn: { paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  applyMinsBtnText: { color: '#121214', fontWeight: '800', fontSize: 12.5 },
  scheduleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  scheduleTitle: { fontSize: 16.5, fontWeight: '800' },
  addScheduleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  examCard: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12 },
  examTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  examTypeBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  subjectCodeText: { fontSize: 15, fontWeight: '900' },
  subjectNameText: { fontSize: 12, marginTop: 1 },
  examMetaGrid: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 6, marginBottom: 10 },
  metaCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaLabel: { fontSize: 12, width: 72 },
  metaValue: { fontSize: 12.5, fontWeight: '700', flex: 1 },
  countdownBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, borderWidth: 1, marginBottom: 10 },
  customPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  examActionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  iconOnlyBtn: { width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
  emptyBox: { padding: 28, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
});
