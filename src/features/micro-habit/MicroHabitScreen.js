// src/features/micro-habit/MicroHabitScreen.js
// Màn hình theo dõi việc vặt & Chu kỳ sinh hoạt (Micro-Habit & Refill Tracker)
// Hoạt động theo cơ chế "Bấm nút để Reset vòng lặp" dựa trên 3 kiểu chu kỳ thực tế

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
} from './microHabitService';

const FILTER_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'urgent', label: 'Khẩn cấp 🚨' },
  { id: 'interval', label: 'Theo ngày 🔄' },
  { id: 'monthly', label: 'Hàng tháng 📅' },
  { id: 'daily', label: 'Trong ngày 🎯' },
];

const PRESET_ICONS = ['construct', 'water', 'bed', 'home', 'wifi', 'medkit', 'pint', 'car', 'fitness', 'repeat'];
const PRESET_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

export default function MicroHabitScreen({ navigation }) {
  const { colors } = useTheme();
  const [habits, setHabits] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedHabitForHistory, setSelectedHabitForHistory] = useState(null);

  // Form State thêm việc mới
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
          onPress: () => {
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
    setModalVisible(true);
  };

  // 5. Lưu việc vặt từ Modal
  const handleSaveForm = () => {
    const trimmedTitle = formTitle.trim();
    if (!trimmedTitle) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên công việc / thói quen.');
      return;
    }

    if (editingId) {
      // Sửa
      const updated = habits.map((h) => {
        if (h.id === editingId) {
          return {
            ...h,
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
          };
        }
        return h;
      });
      updateHabitsList(updated);
    } else {
      // Thêm mới
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
        history: [],
      };
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
        {/* Header thẻ: Icon, Tên, Category, Nút Xóa */}
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
          <Pressable
            onPress={() => handleDeleteHabit(item.id, item.title)}
            hitSlop={8}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={18} color={colors.sub} />
          </Pressable>
        </View>

        {/* Badge trạng thái cảnh báo màu sắc */}
        <View style={styles.statusRow}>
          <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor + '20', borderColor: urgencyColor }]}>
            <View style={[styles.urgencyDot, { backgroundColor: urgencyColor }]} />
            <Text style={[styles.urgencyText, { color: urgencyColor }]}>
              {status.statusText}
            </Text>
          </View>

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
                {item.history.length} lần xong
              </Text>
            </Pressable>
          )}
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

      {/* Modal Thêm / Chỉnh sửa việc vặt */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingId ? 'Chỉnh sửa việc vặt' : 'Thêm việc vặt & Chu kỳ mới'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.sub} />
              </Pressable>
            </View>

            {/* Chọn loại chu kỳ */}
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Loại chu kỳ lặp</Text>
            <View style={styles.typeSelectorRow}>
              {[
                { type: HABIT_TYPES.INTERVAL, label: 'Theo số ngày 🔄', desc: 'Mỗi X ngày' },
                { type: HABIT_TYPES.MONTHLY, label: 'Hàng tháng 📅', desc: 'Ngày cố định' },
                { type: HABIT_TYPES.DAILY, label: 'Trong ngày 🎯', desc: 'Đếm số lần' },
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

            {/* Ghi chú */}
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Ghi chú thêm</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              value={formNote}
              onChangeText={setFormNote}
              placeholder="VD: Nhớt 10W40, STK chủ nhà 1903..."
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
              <Text style={styles.saveBtnText}>Lưu việc vặt</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal Xem lịch sử lần hoàn thành */}
      <Modal
        visible={historyModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Lịch sử: {selectedHabitForHistory?.title}
              </Text>
              <Pressable onPress={() => setHistoryModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.sub} />
              </Pressable>
            </View>

            <View style={{ maxHeight: 300, marginVertical: 12 }}>
              {selectedHabitForHistory?.history && selectedHabitForHistory.history.length > 0 ? (
                selectedHabitForHistory.history.map((h, idx) => (
                  <View key={h.id || idx} style={[styles.historyRow, { borderBottomColor: colors.cardBorder }]}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={[styles.historyDateText, { color: colors.text }]}>
                      {new Date(h.timestamp).toLocaleDateString('vi-VN')} {new Date(h.timestamp).toLocaleTimeString('vi-VN')}
                    </Text>
                    <Text style={[styles.historyNoteText, { color: colors.sub }]}>{h.note}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyText, { color: colors.sub }]}>Chưa có lịch sử.</Text>
              )}
            </View>

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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
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
  deleteBtn: { padding: 4 },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  urgencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  urgencyDot: { width: 6, height: 6, borderRadius: 3 },
  urgencyText: { fontSize: 12, fontWeight: '700' },
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
    justifyContent: 'center', padding: 20,
  },
  modalContent: {
    borderRadius: 24, padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 10 },
  typeSelectorRow: { flexDirection: 'row', gap: 6 },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  typeBtnText: { fontSize: 11, fontWeight: '700' },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14,
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

