// src/features/micro-habit/MicroHabitScreen.js
// Màn hình theo dõi việc vặt & Chu kỳ sinh hoạt (Micro-Habit & Refill Tracker)
// Tự động đếm ngược, cảnh báo màu sắc, hỗ trợ tùy chọn thông báo nhắc nhở theo giờ

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  FlatList,
  Modal,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';
import {
  HABIT_TYPES,
  calculateHabitStatus,
  loadHabits,
  saveHabits,
  getTodayDateString,
  scheduleHabitReminder,
  cancelHabitReminder,
} from './microHabitService';

const FILTER_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'urgent', label: 'Khẩn cấp 🚨' },
  { id: 'interval', label: 'Theo ngày 🔄' },
  { id: 'monthly', label: 'Hàng tháng 📅' },
  { id: 'daily', label: 'Trong ngày 🎯' },
];

const PRESET_HOURS = ['07:00', '08:00', '12:00', '18:00', '20:00', '22:00'];
const PRESET_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

export default function MicroHabitScreen({ navigation }) {
  const { colors } = useTheme();
  const [habits, setHabits] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedHabitForHistory, setSelectedHabitForHistory] = useState(null);

  // Form State thêm / chỉnh sửa việc
  const [editingId, setEditingId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState(HABIT_TYPES.INTERVAL);
  const [formIntervalDays, setFormIntervalDays] = useState('30');
  const [formDayOfMonth, setFormDayOfMonth] = useState('5');
  const [formTargetCount, setFormTargetCount] = useState('2');
  const [formUnit, setFormUnit] = useState('lần');
  const [formCategory, setFormCategory] = useState('Sinh hoạt');
  const [formNote, setFormNote] = useState('');
  const [formIcon, setFormIcon] = useState('repeat');
  const [formColor, setFormColor] = useState('#10B981');
  const [formReminderEnabled, setFormReminderEnabled] = useState(false);
  const [formReminderTime, setFormReminderTime] = useState('08:00');

  // Tải danh sách thói quen khi mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const data = await loadHabits();
      if (isMounted) setHabits(data);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Tính toán trạng thái cho từng item
  const habitsWithStatus = useMemo(() => {
    return habits.map((item) => {
      const status = calculateHabitStatus(item);
      return {
        ...item,
        status,
      };
    });
  }, [habits]);

  // Thống kê tổng quan
  const stats = useMemo(() => {
    let overdueCount = 0;
    let warningCount = 0;
    let safeCount = 0;

    habitsWithStatus.forEach((h) => {
      if (h.status.urgency === 'overdue') overdueCount += 1;
      else if (h.status.urgency === 'warning') warningCount += 1;
      else safeCount += 1;
    });

    return {
      total: habitsWithStatus.length,
      overdue: overdueCount,
      warning: warningCount,
      safe: safeCount,
    };
  }, [habitsWithStatus]);

  // Lọc theo tab
  const filteredHabits = useMemo(() => {
    if (activeFilter === 'all') return habitsWithStatus;
    if (activeFilter === 'urgent') {
      return habitsWithStatus.filter((h) => h.status.urgency === 'overdue' || h.status.urgency === 'warning');
    }
    if (activeFilter === 'interval') {
      return habitsWithStatus.filter((h) => h.type === HABIT_TYPES.INTERVAL);
    }
    if (activeFilter === 'monthly') {
      return habitsWithStatus.filter((h) => h.type === HABIT_TYPES.MONTHLY);
    }
    if (activeFilter === 'daily') {
      return habitsWithStatus.filter((h) => h.type === HABIT_TYPES.DAILY);
    }
    return habitsWithStatus;
  }, [habitsWithStatus, activeFilter]);

  // Lưu danh sách và cập nhật state
  const updateHabitsList = useCallback(async (newHabits) => {
    setHabits(newHabits);
    await saveHabits(newHabits);
  }, []);

  // 1. Reset chu kỳ: Vừa làm xong (cho Interval & Monthly)
  const handleCompleteHabit = useCallback((id) => {
    const nowIso = new Date().toISOString();
    const updated = habits.map((item) => {
      if (item.id === id) {
        const historyItem = {
          id: Date.now().toString(),
          timestamp: nowIso,
          note: 'Hoàn thành chu kỳ',
        };
        const prevHistory = Array.isArray(item.history) ? item.history : [];
        return {
          ...item,
          lastCompletedDate: nowIso,
          history: [historyItem, ...prevHistory].slice(0, 30),
        };
      }
      return item;
    });
    updateHabitsList(updated);
  }, [habits, updateHabitsList]);

  // 2. Tăng/Giảm tiến độ trong ngày (cho Daily Counter)
  const handleStepDaily = useCallback((id, delta) => {
    const todayStr = getTodayDateString();
    const updated = habits.map((item) => {
      if (item.id === id) {
        const current = item.lastDailyDate === todayStr ? (item.currentCount || 0) : 0;
        const newCount = Math.max(0, current + delta);
        return {
          ...item,
          currentCount: newCount,
          lastDailyDate: todayStr,
        };
      }
      return item;
    });
    updateHabitsList(updated);
  }, [habits, updateHabitsList]);

  // 3. Xóa việc vặt
  const handleDeleteHabit = useCallback((id, title) => {
    Alert.alert(
      'Xóa việc vặt',
      `Bạn có chắc chắn muốn xóa "${title}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa vĩnh viễn',
          style: 'destructive',
          onPress: async () => {
            const habitToDelete = habits.find((h) => h.id === id);
            if (habitToDelete?.notificationId) {
              await cancelHabitReminder(habitToDelete.notificationId);
            }
            const remaining = habits.filter((h) => h.id !== id);
            updateHabitsList(remaining);
          },
        },
      ]
    );
  }, [habits, updateHabitsList]);

  // 4. Mở Modal Thêm mới
  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormTitle('');
    setFormType(HABIT_TYPES.INTERVAL);
    setFormIntervalDays('30');
    setFormDayOfMonth('5');
    setFormTargetCount('2');
    setFormUnit('lần');
    setFormCategory('Sinh hoạt');
    setFormNote('');
    setFormIcon('repeat');
    setFormColor('#10B981');
    setFormReminderEnabled(false);
    setFormReminderTime('08:00');
    setModalVisible(true);
  };

  // 5. Mở Modal Chỉnh sửa
  const handleOpenEditModal = (item) => {
    setEditingId(item.id);
    setFormTitle(item.title || '');
    setFormType(item.type || HABIT_TYPES.INTERVAL);
    setFormIntervalDays(String(item.intervalDays || 30));
    setFormDayOfMonth(String(item.dayOfMonth || 5));
    setFormTargetCount(String(item.targetCount || 2));
    setFormUnit(item.unit || 'lần');
    setFormCategory(item.category || 'Sinh hoạt');
    setFormNote(item.note || '');
    setFormIcon(item.icon || 'repeat');
    setFormColor(item.color || '#10B981');
    setFormReminderEnabled(!!item.reminderEnabled);
    setFormReminderTime(item.reminderTime || '08:00');
    setModalVisible(true);
  };

  // 6. Bật/Tắt nhanh nhắc nhở trên thẻ
  const handleQuickToggleReminder = async (item) => {
    const newEnabled = !item.reminderEnabled;
    let newNotifId = null;

    if (newEnabled) {
      newNotifId = await scheduleHabitReminder({
        ...item,
        reminderEnabled: true,
        reminderTime: item.reminderTime || '08:00',
      });
      Alert.alert('Đã bật nhắc nhở', `Thông báo sẽ nhắc lúc ${item.reminderTime || '08:00'} hàng ngày.`);
    } else {
      await cancelHabitReminder(item.notificationId);
      Alert.alert('Đã tắt nhắc nhở', `Đã hủy lịch nhắc cho "${item.title}".`);
    }

    const updated = habits.map((h) => {
      if (h.id === item.id) {
        return {
          ...h,
          reminderEnabled: newEnabled,
          notificationId: newNotifId,
        };
      }
      return h;
    });
    updateHabitsList(updated);
  };

  // 7. Lưu việc vặt từ Modal (Thêm hoặc Sửa)
  const handleSaveForm = async () => {
    const trimmedTitle = formTitle.trim();
    if (!trimmedTitle) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên công việc / thói quen.');
      return;
    }

    let validTime = formReminderTime.trim();
    if (formReminderEnabled) {
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(validTime)) {
        Alert.alert('Giờ không hợp lệ', 'Vui lòng nhập giờ theo định dạng HH:mm (VD: 08:00, 19:30).');
        return;
      }
    }

    if (editingId) {
      // Đang sửa
      const currentItem = habits.find((h) => h.id === editingId);
      const habitDraft = {
        ...(currentItem || {}),
        id: editingId,
        title: trimmedTitle,
        type: formType,
        intervalDays: parseInt(formIntervalDays || 1, 10),
        dayOfMonth: parseInt(formDayOfMonth || 1, 10),
        targetCount: parseInt(formTargetCount || 1, 10),
        unit: formUnit.trim() || 'lần',
        category: formCategory.trim() || 'Khác',
        note: formNote.trim(),
        icon: formIcon,
        color: formColor,
        reminderEnabled: formReminderEnabled,
        reminderTime: validTime || '08:00',
      };

      const newNotifId = await scheduleHabitReminder(habitDraft);
      habitDraft.notificationId = newNotifId;

      const updated = habits.map((h) => (h.id === editingId ? habitDraft : h));
      updateHabitsList(updated);
    } else {
      // Đang thêm mới
      const newHabit = {
        id: `habit-${Date.now()}`,
        title: trimmedTitle,
        type: formType,
        intervalDays: parseInt(formIntervalDays || 1, 10),
        dayOfMonth: parseInt(formDayOfMonth || 1, 10),
        targetCount: parseInt(formTargetCount || 1, 10),
        unit: formUnit.trim() || 'lần',
        category: formCategory.trim() || 'Khác',
        note: formNote.trim(),
        icon: formIcon,
        color: formColor,
        lastCompletedDate: new Date().toISOString(),
        currentCount: 0,
        lastDailyDate: getTodayDateString(),
        reminderEnabled: formReminderEnabled,
        reminderTime: validTime || '08:00',
        notificationId: null,
        history: [],
      };

      if (formReminderEnabled) {
        const notifId = await scheduleHabitReminder(newHabit);
        newHabit.notificationId = notifId;
      }

      updateHabitsList([newHabit, ...habits]);
    }

    setModalVisible(false);
  };

  // Màu sắc theo urgency
  const getUrgencyColor = (urgency) => {
    if (urgency === 'overdue') return '#EF4444'; // Đỏ
    if (urgency === 'warning') return '#F59E0B'; // Vàng
    return '#10B981'; // Xanh
  };

  // Render từng thẻ việc vặt
  const renderHabitItem = ({ item }) => {
    const { status } = item;
    const urgencyColor = getUrgencyColor(status.urgency);

    return (
      <View style={[styles.habitCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        {/* Header thẻ: Icon, Tên, Category, Nút Sửa, Nút Xóa */}
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconBox, { backgroundColor: item.color + '20' }]}>
            <Ionicons name={item.icon || 'repeat'} size={22} color={item.color || colors.primary} />
          </View>
          <View style={styles.cardTitleBox}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={[styles.categoryBadge, { backgroundColor: colors.cardElevated }]}>
                <Text style={[styles.categoryBadgeText, { color: colors.sub }]}>{item.category || 'Chung'}</Text>
              </View>
            </View>
            {item.note ? (
              <Text style={[styles.cardNote, { color: colors.sub }]} numberOfLines={1}>
                {item.note}
              </Text>
            ) : null}
          </View>

          {/* Nút Sửa */}
          <Pressable
            onPress={() => handleOpenEditModal(item)}
            hitSlop={8}
            style={styles.cardHeaderBtn}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.sub} />
          </Pressable>

          {/* Nút Xóa */}
          <Pressable
            onPress={() => handleDeleteHabit(item.id, item.title)}
            hitSlop={8}
            style={styles.cardHeaderBtn}
          >
            <Ionicons name="trash-outline" size={18} color={colors.sub} />
          </Pressable>
        </View>

        {/* Trạng thái hạn chót & Huy hiệu nhắc nhở theo giờ */}
        <View style={styles.statusRow}>
          <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor + '20', borderColor: urgencyColor }]}>
            <View style={[styles.urgencyDot, { backgroundColor: urgencyColor }]} />
            <Text style={[styles.urgencyText, { color: urgencyColor }]}>
              {status.statusText}
            </Text>
          </View>

          <View style={styles.statusRightRow}>
            {/* Huy hiệu nhắc nhở theo giờ (bấm để bật/tắt nhanh) */}
            <Pressable
              onPress={() => handleQuickToggleReminder(item)}
              hitSlop={6}
              style={[
                styles.reminderBadge,
                {
                  backgroundColor: item.reminderEnabled ? '#10B98120' : colors.cardElevated,
                  borderColor: item.reminderEnabled ? '#10B981' : colors.border,
                },
              ]}
            >
              <Ionicons
                name={item.reminderEnabled ? 'notifications' : 'notifications-off-outline'}
                size={13}
                color={item.reminderEnabled ? '#10B981' : colors.sub}
              />
              <Text
                style={[
                  styles.reminderBadgeText,
                  { color: item.reminderEnabled ? '#10B981' : colors.sub },
                ]}
              >
                {item.reminderEnabled ? item.reminderTime || '08:00' : 'Tắt'}
              </Text>
            </Pressable>

            {/* Nút xem lịch sử */}
            {item.history && item.history.length > 0 && (
              <Pressable
                onPress={() => {
                  setSelectedHabitForHistory(item);
                  setHistoryModalVisible(true);
                }}
                hitSlop={6}
                style={styles.historyLink}
              >
                <Ionicons name="time-outline" size={14} color={colors.sub} />
                <Text style={[styles.historyLinkText, { color: colors.sub }]}>
                  {item.history.length} lần
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Thanh tiến trình chu kỳ */}
        <View style={[styles.progressBarBg, { backgroundColor: colors.cardElevated }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: urgencyColor,
                width: `${Math.round(status.progress * 100)}%`,
              },
            ]}
          />
        </View>

        {/* Nút bấm hành động Reset vòng lặp */}
        <View style={styles.actionRow}>
          {item.type === HABIT_TYPES.INTERVAL && (
            <Pressable
              onPress={() => handleCompleteHabit(item.id)}
              style={[styles.resetBtn, { backgroundColor: urgencyColor }]}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.resetBtnText}>
                Vừa làm xong · Reset {item.intervalDays} ngày
              </Text>
            </Pressable>
          )}

          {item.type === HABIT_TYPES.MONTHLY && (
            <Pressable
              onPress={() => handleCompleteHabit(item.id)}
              style={[styles.resetBtn, { backgroundColor: urgencyColor }]}
            >
              <Ionicons name="calendar" size={18} color="#FFFFFF" />
              <Text style={styles.resetBtnText}>
                Đã hoàn thành · Chuyển tháng tới
              </Text>
            </Pressable>
          )}

          {item.type === HABIT_TYPES.DAILY && (
            <View style={styles.dailyCounterRow}>
              <Pressable
                onPress={() => handleStepDaily(item.id, -1)}
                style={[styles.stepBtnMinus, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
              >
                <Ionicons name="remove" size={18} color={colors.sub} />
              </Pressable>

              <Pressable
                onPress={() => handleStepDaily(item.id, 1)}
                style={[styles.stepBtnPlus, { backgroundColor: urgencyColor }]}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.stepBtnPlusText}>
                  {status.isCompleted ? 'Đã đạt mục tiêu (+1)' : `+1 ${item.unit || 'lần'} (${status.currentCount}/${status.targetCount})`}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Chu kỳ việc vặt & Sinh hoạt"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <FlatList
        data={filteredHabits}
        keyExtractor={(item) => item.id}
        renderItem={renderHabitItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Thẻ Thống kê Tổng quan */}
            <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.statsHeader}>
                <View style={styles.statsTitleRow}>
                  <Ionicons name="repeat" size={20} color="#10B981" />
                  <Text style={[styles.statsTitle, { color: colors.text }]}>Theo dõi chu kỳ tự động</Text>
                </View>
                <Pressable
                  onPress={handleOpenAddModal}
                  style={[styles.addTopBtn, { backgroundColor: '#10B981' }]}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.addTopBtnText}>Thêm việc</Text>
                </Pressable>
              </View>

              <View style={styles.statsGrid}>
                <View style={[styles.statBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <Text style={[styles.statNumber, { color: '#EF4444' }]}>{stats.overdue}</Text>
                  <Text style={[styles.statLabel, { color: colors.sub }]}>Quá hạn</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{stats.warning}</Text>
                  <Text style={[styles.statLabel, { color: colors.sub }]}>Sắp đến hạn</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Text style={[styles.statNumber, { color: '#10B981' }]}>{stats.safe}</Text>
                  <Text style={[styles.statLabel, { color: colors.sub }]}>An toàn / Xong</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.cardElevated }]}>
                  <Text style={[styles.statNumber, { color: colors.text }]}>{stats.total}</Text>
                  <Text style={[styles.statLabel, { color: colors.sub }]}>Tổng việc</Text>
                </View>
              </View>
            </View>

            {/* Bộ lọc Tab */}
            <View style={styles.filterRow}>
              {FILTER_TABS.map((tab) => {
                const isActive = activeFilter === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveFilter(tab.id)}
                    style={[
                      styles.filterTab,
                      {
                        backgroundColor: isActive ? '#10B981' : colors.card,
                        borderColor: isActive ? '#10B981' : colors.cardBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterTabText,
                        { color: isActive ? '#FFFFFF' : colors.sub },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.sub} />
            <Text style={[styles.emptyText, { color: colors.sub }]}>
              Không có việc vặt nào trong danh mục này.
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />

      {/* Modal Thêm / Chỉnh sửa việc vặt (Sử dụng FlatList cuộn chuẩn - CẤM ScrollView) */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingId ? 'Chỉnh sửa việc vặt' : 'Thêm việc vặt & Chu kỳ mới'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.sub} />
              </Pressable>
            </View>

            <FlatList
              data={[{ key: 'form-body' }]}
              keyExtractor={(item) => item.key}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={() => (
                <View style={styles.formContainer}>
                  {/* Chọn loại chu kỳ */}
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Loại chu kỳ lặp</Text>
                  <View style={styles.typeSelectorRow}>
                    {[
                      { type: HABIT_TYPES.INTERVAL, label: 'Theo ngày 🔄' },
                      { type: HABIT_TYPES.MONTHLY, label: 'Hàng tháng 📅' },
                      { type: HABIT_TYPES.DAILY, label: 'Trong ngày 🎯' },
                    ].map((t) => (
                      <Pressable
                        key={t.type}
                        onPress={() => setFormType(t.type)}
                        style={[
                          styles.typeBtn,
                          {
                            backgroundColor: formType === t.type ? '#10B981' : colors.cardElevated,
                            borderColor: formType === t.type ? '#10B981' : colors.cardBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.typeBtnText, { color: formType === t.type ? '#FFFFFF' : colors.text }]}>
                          {t.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Tên việc */}
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Tên việc vặt / Thói quen</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={formTitle}
                    onChangeText={setFormTitle}
                    placeholder="VD: Thay nhớt xe, Đóng tiền trọ, Uống thuốc..."
                    placeholderTextColor={colors.sub}
                    autoCapitalize="sentences"
                  />

                  {/* Thiết lập tham số chu kỳ tương ứng */}
                  {formType === HABIT_TYPES.INTERVAL && (
                    <>
                      <Text style={[styles.fieldLabel, { color: colors.text }]}>Chu kỳ lặp lại (Số ngày)</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                        value={formIntervalDays}
                        onChangeText={setFormIntervalDays}
                        keyboardType="numeric"
                        placeholder="VD: 15, 30, 45 ngày"
                        placeholderTextColor={colors.sub}
                      />
                    </>
                  )}

                  {formType === HABIT_TYPES.MONTHLY && (
                    <>
                      <Text style={[styles.fieldLabel, { color: colors.text }]}>Ngày đến hạn hàng tháng (1 - 31)</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                        value={formDayOfMonth}
                        onChangeText={setFormDayOfMonth}
                        keyboardType="numeric"
                        placeholder="VD: 5 (mùng 5 hàng tháng)"
                        placeholderTextColor={colors.sub}
                      />
                    </>
                  )}

                  {formType === HABIT_TYPES.DAILY && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Mục tiêu ngày</Text>
                        <TextInput
                          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                          value={formTargetCount}
                          onChangeText={setFormTargetCount}
                          keyboardType="numeric"
                          placeholder="VD: 8"
                          placeholderTextColor={colors.sub}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Đơn vị tính</Text>
                        <TextInput
                          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                          value={formUnit}
                          onChangeText={setFormUnit}
                          placeholder="VD: cốc, lần, viên"
                          placeholderTextColor={colors.sub}
                        />
                      </View>
                    </View>
                  )}

                  {/* THIẾT LẬP THÔNG BÁO NHẮC NHỞ THEO GIỜ (TÙY CHỌN) */}
                  <View style={[styles.reminderSection, { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder }]}>
                    <View style={styles.reminderHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="notifications" size={18} color="#10B981" />
                        <Text style={[styles.reminderSectionTitle, { color: colors.text }]}>
                          Nhắc nhở theo giờ (Tùy chọn)
                        </Text>
                      </View>
                      <Switch
                        value={formReminderEnabled}
                        onValueChange={setFormReminderEnabled}
                        trackColor={{ false: colors.cardBorder, true: '#10B981' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>

                    {formReminderEnabled && (
                      <View style={styles.reminderBody}>
                        <Text style={[styles.reminderHint, { color: colors.sub }]}>
                          Chọn khung giờ hoặc nhập giờ nhắc cụ thể (HH:mm):
                        </Text>

                        {/* Các mốc giờ phổ biến */}
                        <View style={styles.presetHoursRow}>
                          {PRESET_HOURS.map((h) => (
                            <Pressable
                              key={h}
                              onPress={() => setFormReminderTime(h)}
                              style={[
                                styles.hourChip,
                                {
                                  backgroundColor: formReminderTime === h ? '#10B981' : colors.card,
                                  borderColor: formReminderTime === h ? '#10B981' : colors.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.hourChipText,
                                  { color: formReminderTime === h ? '#FFFFFF' : colors.text },
                                ]}
                              >
                                {h}
                              </Text>
                            </Pressable>
                          ))}
                        </View>

                        {/* Input nhập giờ tùy chỉnh */}
                        <View style={styles.customTimeInputRow}>
                          <Text style={[styles.customTimeLabel, { color: colors.sub }]}>Giờ cụ thể:</Text>
                          <TextInput
                            style={[styles.customTimeInput, { color: colors.text, borderColor: colors.border }]}
                            value={formReminderTime}
                            onChangeText={setFormReminderTime}
                            placeholder="08:00"
                            placeholderTextColor={colors.sub}
                            maxLength={5}
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Danh mục */}
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Nhóm / Danh mục</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={formCategory}
                    onChangeText={setFormCategory}
                    placeholder="VD: Xe cộ, Sức khỏe, Gia đình, Chi phí..."
                    placeholderTextColor={colors.sub}
                  />

                  {/* Ghi chú */}
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Ghi chú thêm</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={formNote}
                    onChangeText={setFormNote}
                    placeholder="VD: Nhớt 10W40, STK chủ nhà..."
                    placeholderTextColor={colors.sub}
                  />

                  {/* Chọn màu sắc */}
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Màu đại diện</Text>
                  <View style={styles.colorPalette}>
                    {PRESET_COLORS.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setFormColor(c)}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: c },
                          formColor === c && styles.colorCircleSelected,
                        ]}
                      />
                    ))}
                  </View>

                  {/* Nút Submit */}
                  <Pressable
                    onPress={handleSaveForm}
                    style={[styles.saveBtn, { backgroundColor: '#10B981' }]}
                  >
                    <Text style={styles.saveBtnText}>
                      {editingId ? 'Cập nhật việc vặt' : 'Lưu việc vặt mới'}
                    </Text>
                  </Pressable>
                  <View style={{ height: 20 }} />
                </View>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Xem lịch sử lần hoàn thành */}
      <Modal
        visible={historyModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Lịch sử: {selectedHabitForHistory?.title}
              </Text>
              <Pressable onPress={() => setHistoryModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.sub} />
              </Pressable>
            </View>

            <FlatList
              data={selectedHabitForHistory?.history || []}
              keyExtractor={(h, idx) => h.id || String(idx)}
              style={{ maxHeight: 320, marginVertical: 12 }}
              renderItem={({ item: h }) => (
                <View style={[styles.historyRow, { borderBottomColor: colors.cardBorder }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={[styles.historyDateText, { color: colors.text }]}>
                    {new Date(h.timestamp).toLocaleDateString('vi-VN')} {new Date(h.timestamp).toLocaleTimeString('vi-VN')}
                  </Text>
                  <Text style={[styles.historyNoteText, { color: colors.sub }]}>{h.note}</Text>
                </View>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.sub, textAlign: 'center', marginVertical: 20 }]}>
                  Chưa có lịch sử.
                </Text>
              }
            />

            <Pressable
              onPress={() => setHistoryModalVisible(false)}
              style={[styles.saveBtn, { backgroundColor: colors.cardElevated }]}
            >
              <Text style={[styles.saveBtnText, { color: colors.text }]}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Stats Card
  statsCard: {
    borderRadius: 20, padding: 16, borderWidth: 1, marginBottom: 14,
  },
  statsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  statsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statsTitle: { fontSize: 16, fontWeight: '800' },
  addTopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  addTopBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
  },
  statNumber: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '600' },

  // Tabs
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  filterTab: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1,
  },
  filterTabText: { fontSize: 12, fontWeight: '700' },

  // Habit Card
  habitCard: {
    borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardIconBox: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitleBox: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
  categoryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  categoryBadgeText: { fontSize: 10, fontWeight: '700' },
  cardNote: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  cardHeaderBtn: { padding: 4 },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  statusRightRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  urgencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  urgencyDot: { width: 6, height: 6, borderRadius: 3 },
  urgencyText: { fontSize: 12, fontWeight: '700' },
  reminderBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1,
  },
  reminderBadgeText: { fontSize: 11, fontWeight: '700' },
  historyLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyLinkText: { fontSize: 11, fontWeight: '600' },

  progressBarBg: {
    height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 12,
  },
  progressBarFill: { height: '100%', borderRadius: 3 },

  actionRow: { marginTop: 2 },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12,
  },
  resetBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  dailyCounterRow: { flexDirection: 'row', gap: 8 },
  stepBtnMinus: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnPlus: {
    flex: 1, height: 44, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  stepBtnPlusText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyText: { fontSize: 14, fontWeight: '500', marginTop: 10 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', padding: 16,
  },
  modalCard: {
    borderRadius: 24, padding: 18, maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  formContainer: { paddingVertical: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 10 },
  typeSelectorRow: { flexDirection: 'row', gap: 6 },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  typeBtnText: { fontSize: 11, fontWeight: '700' },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14,
  },

  // Reminder section in modal
  reminderSection: {
    borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 14,
  },
  reminderHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  reminderSectionTitle: { fontSize: 13, fontWeight: '800' },
  reminderBody: { marginTop: 10 },
  reminderHint: { fontSize: 12, marginBottom: 8 },
  presetHoursRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  hourChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
  },
  hourChipText: { fontSize: 12, fontWeight: '700' },
  customTimeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customTimeLabel: { fontSize: 12, fontWeight: '600' },
  customTimeInput: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    width: 80, textAlign: 'center', fontSize: 14, fontWeight: '700',
  },

  colorPalette: { flexDirection: 'row', gap: 8, marginVertical: 6 },
  colorCircle: { width: 28, height: 28, borderRadius: 14 },
  colorCircleSelected: { borderWidth: 3, borderColor: '#FFFFFF' },
  saveBtn: {
    paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 16,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 0.5,
  },
  historyDateText: { fontSize: 12, fontWeight: '700' },
  historyNoteText: { fontSize: 11, flex: 1, textAlign: 'right' },
});
