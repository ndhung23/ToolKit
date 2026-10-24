// src/screens/tools/FapExamScreen.js
// Tiện ích: Đăng nhập cổng FAP (fap.fpt.edu.vn) -> Tự động lấy Lịch thi -> Nhắc nhở trước giờ thi

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  Image,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';
import * as SecureStore from '../../utils/storage';
import {
  REMINDER_PRESETS,
  getExamTimeStatus,
  triggerExamNotification,
} from './fapExamHelper';
import {
  ATTENDANCE_STATUS,
  checkSlotAbsentAlert,
  triggerAbsentNotification,
} from './fapAttendanceHelper';
import { FapAuthFlowCard, FapExamFormModal, FapRealWebViewModal } from './FapLoginModals';
import FapAttendanceView from './FapAttendanceView';
import FapExamCard from './FapExamCard';

const STORAGE_FAP_SESSION = 'toolkit_fap_student_session_v1';
const STORAGE_FAP_EXAMS = 'toolkit_fap_exam_list_v1';
const STORAGE_FAP_REMINDER_MINS = 'toolkit_fap_reminder_mins_v1';
const STORAGE_FAP_ATTENDANCE_SLOTS = 'toolkit_fap_attendance_slots_v1';
const STORAGE_FAP_ABSENT_ALERT_ENABLED = 'toolkit_fap_absent_alert_v1';

export default function FapExamScreen({ navigation }) {
  const { colors } = useTheme();

  const [fapUser, setFapUser] = useState(null);
  const [exams, setExams] = useState([]);
  const [activeTab, setActiveTab] = useState('exam'); // 'exam' | 'attendance'
  const [todaySlots, setTodaySlots] = useState([]); // Không mock data - cào thật từ FAP!
  const [absentAlertEnabled, setAbsentAlertEnabled] = useState(true);
  const [realWebViewVisible, setRealWebViewVisible] = useState(false);
  const [webViewTarget, setWebViewTarget] = useState('exam'); // 'exam' | 'timetable'
  const [defaultReminderMins, setDefaultReminderMins] = useState(30);
  const [customMinsInput, setCustomMinsInput] = useState('30');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const examsRef = useRef(exams);
  examsRef.current = exams;
  const defaultMinsRef = useRef(defaultReminderMins);
  defaultMinsRef.current = defaultReminderMins;
  const todaySlotsRef = useRef(todaySlots);
  todaySlotsRef.current = todaySlots;
  const absentAlertRef = useRef(absentAlertEnabled);
  absentAlertRef.current = absentAlertEnabled;

  // 1. Khôi phục phiên đăng nhập FAP, lịch thi, điểm danh & cấu hình thời gian nhắc từ bộ nhớ
  useEffect(() => {
    (async () => {
      try {
        const [savedSession, savedExams, savedMins, savedSlots, savedAlertToggle] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_FAP_SESSION),
          SecureStore.getItemAsync(STORAGE_FAP_EXAMS),
          SecureStore.getItemAsync(STORAGE_FAP_REMINDER_MINS),
          SecureStore.getItemAsync(STORAGE_FAP_ATTENDANCE_SLOTS),
          SecureStore.getItemAsync(STORAGE_FAP_ABSENT_ALERT_ENABLED),
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
        if (savedSlots) {
          const parsedSlots = JSON.parse(savedSlots);
          if (Array.isArray(parsedSlots) && parsedSlots.length > 0) {
            setTodaySlots(parsedSlots);
          }
        }
        if (savedAlertToggle !== null && savedAlertToggle !== undefined) {
          setAbsentAlertEnabled(savedAlertToggle === 'true');
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

      // Kiểm tra Cảnh báo Vắng (Absent Alert): Cuối ca học + 10 phút
      if (absentAlertRef.current) {
        let hasSlotTriggered = false;
        const updatedSlots = todaySlotsRef.current.map((slot) => {
          if (slot.notified) return slot;
          const check = checkSlotAbsentAlert(slot, currentTick);
          if (check.shouldAlert) {
            hasSlotTriggered = true;
            triggerAbsentNotification(slot);
            return { ...slot, notified: true };
          }
          return slot;
        });

        if (hasSlotTriggered) {
          setTodaySlots(updatedSlots);
          SecureStore.setItemAsync(STORAGE_FAP_ATTENDANCE_SLOTS, JSON.stringify(updatedSlots));
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [fapUser]);

  const persistExams = async (nextList) => {
    setExams(nextList);
    await SecureStore.setItemAsync(STORAGE_FAP_EXAMS, JSON.stringify(nextList));
  };

  // Đồng bộ thành công Lịch thi thực tế từ WebView (fap.fpt.edu.vn/ExamSchedule)
  const handleRealSyncSuccess = async (userData, examList) => {
    if (userData) {
      setFapUser((prev) => ({ ...(prev || {}), ...userData }));
      await SecureStore.setItemAsync(STORAGE_FAP_SESSION, JSON.stringify(userData));
    }
    setExams(examList);
    await SecureStore.setItemAsync(STORAGE_FAP_EXAMS, JSON.stringify(examList));
  };

  // Đồng bộ thành công Thời khóa biểu & Điểm danh thực tế từ WebView (fap.fpt.edu.vn/WeeklyTimetable)
  const handleTimetableSyncSuccess = async (userData, slotList) => {
    if (userData) {
      setFapUser((prev) => ({ ...(prev || {}), ...userData }));
      await SecureStore.setItemAsync(STORAGE_FAP_SESSION, JSON.stringify(userData));
    }
    setTodaySlots(slotList);
    await SecureStore.setItemAsync(STORAGE_FAP_ATTENDANCE_SLOTS, JSON.stringify(slotList));
  };

  // Đăng xuất tài khoản FAP
  const handleLogoutFap = () => {
    const doLogout = async () => {
      setFapUser(null);
      setExams([]);
      setTodaySlots([]);
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_FAP_SESSION),
        SecureStore.deleteItemAsync(STORAGE_FAP_EXAMS),
        SecureStore.deleteItemAsync(STORAGE_FAP_ATTENDANCE_SLOTS),
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

  // Bật / tắt chế độ cảnh báo vắng (+10p sau slot)
  const handleToggleAbsentAlert = async (val) => {
    setAbsentAlertEnabled(val);
    await SecureStore.setItemAsync(STORAGE_FAP_ABSENT_ALERT_ENABLED, String(val));
  };

  // Thử chuông cảnh báo vắng ngay lập tức
  const handleSimulateAbsentAlert = () => {
    const target = todaySlots.find((s) => s.status === ATTENDANCE_STATUS.ABSENT) || todaySlots[0];
    triggerAbsentNotification(target);
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

  const renderExamItem = ({ item }) => (
    <FapExamCard
      item={item}
      colors={colors}
      defaultReminderMins={defaultReminderMins}
      now={now}
      onToggleReminder={toggleExamReminder}
      onEditExam={(ex) => {
        setEditingExam(ex);
        setModalVisible(true);
      }}
      onDeleteExam={handleDeleteExam}
    />
  );

  const renderStudentHeaderAndTabs = () => (
    <>
      {/* 1. THẺ THÔNG TIN SINH VIÊN FAP */}
      <View style={styles.studentBanner}>
        <View style={styles.studentTopRow}>
          <View style={styles.studentAvatarContainer}>
            <Image
              source={require('../../../assets/iconfap.png')}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.studentLabelSmall}>THÔNG TIN SINH VIÊN • {fapUser.campus || 'Cơ sở Hà Nội (HN)'}</Text>
            <Text style={styles.studentFullName}>{fapUser.name || 'Nguyễn Duy Hưng'}</Text>
            <Text style={styles.studentCodeSub}>{fapUser.studentId || 'HE190591'}</Text>
          </View>
          <Pressable onPress={handleLogoutFap} style={styles.logoutFapBtn} hitSlop={8}>
            <Ionicons name="log-out-outline" size={15} color="#FFFFFF" />
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
            <Text style={styles.studentMetaChipVal} numberOfLines={1}>{fapUser.program || 'BIT_SE_19C_NJ'}</Text>
          </View>
          <View style={styles.studentMetaChip}>
            <Text style={styles.studentMetaChipLabel}>Khóa</Text>
            <Text style={styles.studentMetaChipVal}>{fapUser.cohort || '19'}</Text>
          </View>
        </View>

        <View style={styles.studentSyncActions}>
          <Pressable
            onPress={() => {
              setWebViewTarget('exam');
              setRealWebViewVisible(true);
            }}
            style={[styles.syncFapBtn, { backgroundColor: '#2563EB', flex: 1 }]}
          >
            <Ionicons name="calendar-outline" size={15} color="#FFFFFF" />
            <Text style={[styles.syncFapBtnText, { color: '#FFFFFF' }]}>Lấy Lịch thi</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setWebViewTarget('timetable');
              setRealWebViewVisible(true);
            }}
            style={[styles.syncFapBtn, { backgroundColor: '#10B981', flex: 1.2 }]}
          >
            <Ionicons name="time-outline" size={15} color="#FFFFFF" />
            <Text style={[styles.syncFapBtnText, { color: '#FFFFFF' }]}>Lấy TKB & Điểm danh</Text>
          </Pressable>
        </View>
      </View>

      {/* 2. TAB ĐIỀU HƯỚNG: Lịch thi vs Điểm danh */}
      <View style={[styles.tabBarWrap, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          onPress={() => setActiveTab('exam')}
          style={[
            styles.tabItem,
            activeTab === 'exam' && { backgroundColor: colors.primary },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={15}
            color={activeTab === 'exam' ? '#121214' : colors.sub}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'exam' ? '#121214' : colors.sub },
            ]}
          >
            Lịch thi ({exams.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('attendance')}
          style={[
            styles.tabItem,
            activeTab === 'attendance' && { backgroundColor: colors.primary },
          ]}
        >
          <Ionicons
            name="checkbox-outline"
            size={15}
            color={activeTab === 'attendance' ? '#121214' : colors.sub}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'attendance' ? '#121214' : colors.sub },
            ]}
          >
            Điểm danh
          </Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="FPT FAP"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, overflow: 'hidden' }}>
              <Image
                source={require('../../../assets/iconfap.png')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            </View>
            <Pressable
              onPress={() => {
                setWebViewTarget(activeTab === 'attendance' ? 'timetable' : 'exam');
                setRealWebViewVisible(true);
              }}
              style={[styles.headerAddBtn, { backgroundColor: '#2563EB' }]}
              hitSlop={8}
            >
              <Ionicons name="globe-outline" size={17} color="#FFFFFF" />
            </Pressable>
            {fapUser && activeTab === 'exam' ? (
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

      {fapUser && activeTab === 'attendance' ? (
        <FapAttendanceView
          colors={colors}
          weeklySlots={todaySlots}
          todaySlots={todaySlots}
          absentAlertEnabled={absentAlertEnabled}
          onToggleAbsentAlert={handleToggleAbsentAlert}
          onSyncAttendance={() => {
            setWebViewTarget('timetable');
            setRealWebViewVisible(true);
          }}
          onSimulateAbsentAlert={handleSimulateAbsentAlert}
          headerComponent={renderStudentHeaderAndTabs()}
        />
      ) : (
        <FlatList
          data={fapUser ? exams : []}
          keyExtractor={(item) => item.id}
          renderItem={renderExamItem}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            !fapUser ? (
              <FapAuthFlowCard
                colors={colors}
                onOpenWebView={() => setRealWebViewVisible(true)}
                onOpenPasteModal={() => setModalVisible(true)}
              />
            ) : (
              <>
                {renderStudentHeaderAndTabs()}

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
      )}

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
        initialTarget={webViewTarget}
        colors={colors}
        onSyncSuccess={handleRealSyncSuccess}
        onSyncTimetableSuccess={handleTimetableSyncSuccess}
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
  studentAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
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
  emptyBox: { padding: 28, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  tabBarWrap: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 14,
    gap: 6,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
});
