// src/features/micro-habit/MicroHabitScreen.js
// Màn hình theo dõi việc vặt & Chu kỳ sinh hoạt (Micro-Habit & Refill Tracker)
// Tự động đếm ngược, cảnh báo màu sắc, hỗ trợ tùy chọn thông báo nhắc nhở theo giờ

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';
import { generateHabitsWithAi } from '../../services/geminiService';
import {
  HABIT_TYPES,
  calculateHabitStatus,
  computeNextOccurrence,
  getTodayDateString,
  getHabitStats,
  filterHabits,
  normalizeHabitSearch,
  DEFAULT_CATEGORIES,
  validateCategoryName,
  loadCustomCategories,
  saveCustomCategories,
  HABIT_ATTRIBUTE_COLORS,
  validateHabitTitle,
} from './microHabitService';
import {
  scheduleHabitReminder,
  cancelHabitReminder,
  cancelHabitRemindersForTask,
  testInstantNotification,
  getAllScheduledHabitReminders,
  reconcileHabitReminders,
} from './NotificationService';
import { requestOpenTask } from './TaskSheetStore';
import { ensureHabitsLoaded, setHabits as saveSharedHabits, subscribeHabits, recordHabitCompletion, undoHabitCompletion } from './HabitStore';

const FILTER_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'urgent', label: 'Khẩn cấp 🚨' },
  { id: 'interval', label: 'Theo ngày 🔄' },
  { id: 'monthly', label: 'Hàng tháng 📅' },
  { id: 'daily', label: 'Trong ngày 🎯' },
];

const INTERVAL_PRESETS = [7, 14, 30, 60, 90, 180, 365];
const DAILY_PRESETS = [1, 2, 4, 8, 10];
const DAILY_UNITS = ['lần', 'cốc', 'viên', 'km'];
const CATEGORIES = [...DEFAULT_CATEGORIES, 'Khác'];
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);
const PRESET_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

export default function MicroHabitScreen({ navigation, route }) {
  const { colors } = useTheme();
  const [habits, setHabits] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const listRef = useRef(null);
  const handledRouteHabitId = useRef(null);
  const [highlightHabitId, setHighlightHabitId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedHabitForHistory, setSelectedHabitForHistory] = useState(null);

  // Debug Thông báo OS (VIỆC 5)
  const [debugNotifModalVisible, setDebugNotifModalVisible] = useState(false);
  const [scheduledNotifs, setScheduledNotifs] = useState([]);

  // Gemini AI Gợi ý việc vặt
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Form State thêm / chỉnh sửa việc
  const [editingId, setEditingId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState(HABIT_TYPES.INTERVAL);
  const [formIntervalDays, setFormIntervalDays] = useState('30');
  const [formDayOfMonth, setFormDayOfMonth] = useState('5');
  const [formTargetCount, setFormTargetCount] = useState('2');
  const [formUnit, setFormUnit] = useState('lần');
  const [formCategory, setFormCategory] = useState('Sinh hoạt');
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [customCategories, setCustomCategories] = useState([]);
  const [formNote, setFormNote] = useState('');
  const [formIcon, setFormIcon] = useState('repeat');
  const [formColor, setFormColor] = useState('#10B981');
  const [formReminderEnabled, setFormReminderEnabled] = useState(false);
  const [formReminderTime, setFormReminderTime] = useState('08:00');
  const [formStartDate, setFormStartDate] = useState(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const occurrencePreview = useMemo(() => {
    return computeNextOccurrence({
      type: formType,
      intervalDays: parseInt(formIntervalDays || '1', 10),
      dayOfMonth: parseInt(formDayOfMonth || '1', 10),
      targetCount: parseInt(formTargetCount || '1', 10),
      reminderTime: formReminderTime,
      startDate: formStartDate,
    }, new Date(), formStartDate);
  }, [formType, formIntervalDays, formDayOfMonth, formTargetCount, formReminderTime, formStartDate]);

  // Native Time Picker (VIỆC 1)
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Giờ và phút dạng Date cho DateTimePicker
  const pickerDate = useMemo(() => {
    const parts = (formReminderTime || '08:00').split(':');
    const d = new Date();
    d.setHours(parseInt(parts[0] || '8', 10), parseInt(parts[1] || '0', 10), 0, 0);
    return d;
  }, [formReminderTime]);

  const handleTimePickerChange = useCallback((event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      const h = String(selectedDate.getHours()).padStart(2, '0');
      const m = String(selectedDate.getMinutes()).padStart(2, '0');
      setFormReminderTime(`${h}:${m}`);
    }
  }, []);

  // Mở modal xem danh sách thông báo OS (VIỆC 5)
  const handleOpenDebugNotifs = useCallback(async () => {
    const list = await getAllScheduledHabitReminders();
    setScheduledNotifs(list);
    setDebugNotifModalVisible(true);
  }, []);

  const handleSelfHealNotifications = useCallback(async () => {
    const synchronized = await reconcileHabitReminders(habits);
    await saveSharedHabits(synchronized);
    const list = await getAllScheduledHabitReminders();
    setScheduledNotifs(list);
    Alert.alert('Đã tự đối chiếu & đồng bộ', `Hệ thống đã kiểm tra ${habits.length} việc vặt và cập nhật lại toàn bộ lịch hẹn thông báo trong OS.`);
  }, [habits]);

  // Thử nghiệm gửi thông báo tức thì (2 giây)
  const handleTestNotification = useCallback(async () => {
    try {
      const taskId = editingId || habits[0]?.id;
      await testInstantNotification(
        taskId,
        '🔔 Nhắc việc',
        `${formTitle.trim() || 'Thay nhớt xe máy'}\nĐã đến giờ kiểm tra và hoàn thành chu kỳ sinh hoạt!`
      );
      Alert.alert(
        'Đã bắn thông báo thử nghiệm! 🎉',
        'Thông báo sẽ hiển thị trên thanh thông báo trong 2 giây. Bạn có thể vuốt lên màn hình chính để thấy banner & chuông.'
      );
    } catch (err) {
      Alert.alert('Không thể gửi thông báo', err.message || 'Hãy kiểm tra quyền thông báo trong Cài đặt máy.');
    }
  }, [editingId, formTitle, habits]);

  const handleSimulateNotificationTap = useCallback((taskId) => {
    requestOpenTask(taskId, 'debug-simulation');
  }, []);

  const handleOpenAiModal = useCallback(() => {
    setAiSuggestions([]);
    setAiPrompt('');
    setAiModalVisible(true);
  }, []);

  const handleGenerateAiHabits = useCallback(async (customPrompt) => {
    const text = (customPrompt || aiPrompt || '').trim() || 'Sinh hoạt cá nhân';
    setIsGeneratingAi(true);
    try {
      const results = await generateHabitsWithAi(text);
      setAiSuggestions(results);
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể tạo gợi ý việc vặt bằng AI.');
    } finally {
      setIsGeneratingAi(false);
    }
  }, [aiPrompt]);

  const handleApplyAiHabits = useCallback(async () => {
    if (!aiSuggestions || aiSuggestions.length === 0) return;
    const today = getTodayDateString();

    const newHabits = [...habits];
    for (const item of aiSuggestions) {
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
      const newHabit = {
        id,
        title: item.title,
        type: item.type,
        intervalDays: item.intervalDays || 30,
        dayOfMonth: item.dayOfMonth || 5,
        targetCount: item.targetCount || 1,
        unit: item.unit || 'lần',
        category: 'AI Gợi ý',
        note: 'Được tạo bởi Gemini AI',
        icon: 'sparkles',
        color: item.color || '#3B82F6',
        lastCompletedDate: today,
        dailyCurrentCount: 0,
        dailyLastUpdatedDate: today,
        completionHistory: [
          {
            timestamp: Date.now(),
            date: today,
            note: 'Tạo mới từ gợi ý Gemini AI',
          },
        ],
        reminderEnabled: Boolean(item.reminderTime),
        reminderTime: item.reminderTime || '08:00',
        notificationId: null,
      };

      if (newHabit.reminderEnabled) {
        newHabit.notificationId = await scheduleHabitReminder(newHabit);
      }
      newHabits.unshift(newHabit);
    }

    setHabits(newHabits);
    await saveSharedHabits(newHabits);
    setAiModalVisible(false);
    Alert.alert('Thành công! 🎉', `Đã thêm ${aiSuggestions.length} việc vặt & chu kỳ sinh hoạt vào danh sách.`);
  }, [aiSuggestions, habits]);
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const data = await ensureHabitsLoaded();
      const storedCategories = await loadCustomCategories();
      const synchronized = await reconcileHabitReminders(data);
      if (isMounted) {
        await saveSharedHabits(synchronized);
        setCustomCategories(storedCategories);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => subscribeHabits(setHabits), []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setDebouncedSearch('');
    setActiveFilter('all');
    setActiveStatusFilter(null);
  }, []);

  const showHabitFromNotification = useCallback((habitId) => {
    if (!habitId) return;
    clearFilters();
    setHighlightHabitId(habitId);
    setTimeout(() => {
      const index = habits.findIndex((habit) => habit.id === habitId);
      if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.35 });
    }, 250);
  }, [clearFilters, habits]);

  useEffect(() => {
    const habitId = route?.params?.habitId;
    if (!habitId || handledRouteHabitId.current === habitId) return undefined;
    handledRouteHabitId.current = habitId;
    const timer = setTimeout(() => showHabitFromNotification(habitId), 0);
    return () => clearTimeout(timer);
  }, [route?.params?.habitId, showHabitFromNotification]);

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
  const stats = useMemo(() => getHabitStats(habitsWithStatus), [habitsWithStatus]);

  // Lọc theo tab
  const filteredHabits = useMemo(() => filterHabits(habitsWithStatus, {
    typeFilter: activeFilter,
    statusFilter: activeStatusFilter,
    search: debouncedSearch,
  }), [habitsWithStatus, activeFilter, activeStatusFilter, debouncedSearch]);

  const hasActiveFilters = activeFilter !== 'all' || activeStatusFilter || normalizeHabitSearch(debouncedSearch);

  // Lưu danh sách và cập nhật state
  const updateHabitsList = useCallback(async (newHabits) => {
    await saveSharedHabits(newHabits);
  }, []);

  // 1. Reset chu kỳ: Vừa làm xong (cho Interval & Monthly)
  const handleCompleteHabit = useCallback(async (id) => {
    await recordHabitCompletion(id);
  }, []);

  // 2. Tăng/Giảm tiến độ trong ngày (cho Daily Counter)
  const handleStepDaily = useCallback(async (id, delta) => {
    if (delta > 0) await recordHabitCompletion(id);
    else await undoHabitCompletion(id);
  }, []);

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
            await cancelHabitRemindersForTask(id);
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
    setFormCustomCategory('');
    setFormNote('');
    setFormIcon('repeat');
    setFormColor('#10B981');
    setFormReminderEnabled(false);
    setFormReminderTime('08:00');
    setFormStartDate(null);
    setFormErrors({});
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
    setFormCategory(CATEGORIES.includes(item.category) ? item.category : 'Khác');
    setFormCustomCategory(CATEGORIES.includes(item.category) ? '' : (item.category || ''));
    setFormNote(item.note || '');
    setFormIcon(item.icon || 'repeat');
    setFormColor(item.color || '#10B981');
    setFormReminderEnabled(!!item.reminderEnabled);
    setFormReminderTime(item.reminderTime || '08:00');
    setFormStartDate(item.startDate || null);
    setFormErrors({});
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
      if (!newNotifId) {
        Alert.alert('Chưa bật được nhắc nhở', 'Hãy cấp quyền Thông báo trong Cài đặt rồi thử lại.');
        return;
      }
      Alert.alert('Đã bật nhắc nhở', item.type === HABIT_TYPES.DAILY
        ? `Thông báo sẽ nhắc lúc ${item.reminderTime || '08:00'} mỗi ngày.`
        : `Thông báo sẽ nhắc vào kỳ đến hạn lúc ${item.reminderTime || '08:00'}.`);
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

  // ============================================
  // VALIDATE FORM — Kiểm tra toàn bộ input trước khi lưu
  // ============================================
  const validateHabitForm = useCallback(() => {
    const errors = {};
    const trimmedTitle = formTitle.trim();

    // Validate tên
    const titleError = validateHabitTitle(trimmedTitle);
    if (titleError) errors.title = titleError;

    // Validate theo loại
    if (formType === HABIT_TYPES.INTERVAL) {
      const val = parseInt(formIntervalDays, 10);
      if (!formIntervalDays.trim() || isNaN(val)) {
        errors.intervalDays = 'Vui lòng nhập số ngày.';
      } else if (val < 1) {
        errors.intervalDays = 'Tối thiểu là 1 ngày.';
      } else if (val > 3650) {
        errors.intervalDays = 'Tối đa là 3650 ngày (~10 năm).';
      } else if (!Number.isInteger(Number(formIntervalDays))) {
        errors.intervalDays = 'Chỉ nhập số nguyên.';
      }
    }

    if (formType === HABIT_TYPES.MONTHLY) {
      const val = parseInt(formDayOfMonth, 10);
      if (!formDayOfMonth.trim() || isNaN(val)) {
        errors.dayOfMonth = 'Vui lòng nhập ngày (1-31).';
      } else if (val < 1) {
        errors.dayOfMonth = 'Tối thiểu là ngày 1.';
      } else if (val > 31) {
        errors.dayOfMonth = 'Tối đa là ngày 31.';
      } else if (!Number.isInteger(Number(formDayOfMonth))) {
        errors.dayOfMonth = 'Chỉ nhập số nguyên.';
      }
    }

    if (formType === HABIT_TYPES.DAILY) {
      const val = parseInt(formTargetCount, 10);
      if (!formTargetCount.trim() || isNaN(val)) {
        errors.targetCount = 'Vui lòng nhập mục tiêu.';
      } else if (val < 1) {
        errors.targetCount = 'Tối thiểu là 1.';
      } else if (val > 9999) {
        errors.targetCount = 'Tối đa là 9999.';
      }
    }

    // Validate giờ nhắc nhở
    if (formReminderEnabled) {
      const validTime = (formReminderTime || '').trim();
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(validTime)) {
        errors.reminderTime = 'Giờ không hợp lệ (VD: 08:00, 19:30).';
      }
    }
    if (formCategory === 'Khác') {
      const categoryError = validateCategoryName(formCustomCategory);
      if (categoryError) errors.category = categoryError;
    }

    return errors;
  }, [formTitle, formType, formIntervalDays, formDayOfMonth, formTargetCount, formReminderEnabled, formReminderTime, formCategory, formCustomCategory]);

  // Kiểm tra form có hợp lệ không (dùng để disable nút Lưu)
  const isFormValid = useMemo(() => {
    const errors = validateHabitForm();
    return Object.keys(errors).length === 0;
  }, [validateHabitForm]);

  // 7. Lưu việc vặt từ Modal (Thêm hoặc Sửa)
  const handleSaveForm = async () => {
    const errors = validateHabitForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const trimmedTitle = formTitle.trim();
    const validTime = (formReminderTime || '08:00').trim();
    const selectedCategory = formCategory === 'Khác' ? formCustomCategory.trim().replace(/\s+/g, ' ') : formCategory;
    if (formCategory === 'Khác' && !customCategories.includes(selectedCategory)) {
      const nextCategories = [selectedCategory, ...customCategories].slice(0, 10);
      setCustomCategories(nextCategories);
      await saveCustomCategories(nextCategories);
    }

    // Clamp dayOfMonth cho tháng ngắn (logic xử lý ở microHabitService.calculateHabitStatus)
    const parsedDayOfMonth = Math.min(31, Math.max(1, parseInt(formDayOfMonth || 1, 10)));

    if (editingId) {
      // Đang sửa
      const currentItem = habits.find((h) => h.id === editingId);
      const habitDraft = {
        ...(currentItem || {}),
        id: editingId,
        title: trimmedTitle,
        type: formType,
        intervalDays: Math.max(1, parseInt(formIntervalDays || 1, 10)),
        dayOfMonth: parsedDayOfMonth,
        targetCount: Math.max(1, parseInt(formTargetCount || 1, 10)),
        unit: formUnit.trim() || 'lần',
        category: selectedCategory,
        note: formNote.trim(),
        icon: formIcon,
        color: formColor,
        reminderEnabled: formReminderEnabled,
        reminderTime: validTime || '08:00',
        startDate: formStartDate || null,
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
        intervalDays: Math.max(1, parseInt(formIntervalDays || 1, 10)),
        dayOfMonth: parsedDayOfMonth,
        targetCount: Math.max(1, parseInt(formTargetCount || 1, 10)),
        unit: formUnit.trim() || 'lần',
        category: selectedCategory,
        note: formNote.trim(),
        icon: formIcon,
        color: formColor,
        lastCompletedDate: new Date().toISOString(),
        currentCount: 0,
        lastDailyDate: getTodayDateString(),
        reminderEnabled: formReminderEnabled,
        reminderTime: validTime || '08:00',
        startDate: formStartDate || null,
        notificationId: null,
        history: [],
      };

      if (formReminderEnabled) {
        const notifId = await scheduleHabitReminder(newHabit);
        newHabit.notificationId = notifId;
      }

      updateHabitsList([newHabit, ...habits]);
    }

    // Auto-routing về đúng ô lọc & làm nổi bật (VIỆC AF)
    const savedItem = editingId
      ? { ...habits.find((h) => h.id === editingId), title: trimmedTitle, type: formType, intervalDays: Math.max(1, parseInt(formIntervalDays || 1, 10)), dayOfMonth: parsedDayOfMonth, targetCount: Math.max(1, parseInt(formTargetCount || 1, 10)), startDate: formStartDate || null, reminderTime: validTime || '08:00', reminderEnabled: formReminderEnabled }
      : { id: `habit-${Date.now()}`, title: trimmedTitle, type: formType, startDate: formStartDate || null, reminderTime: validTime || '08:00', reminderEnabled: formReminderEnabled };

    const targetStatus = calculateHabitStatus(savedItem);
    const targetGroup = getHabitStatusGroup(targetStatus);
    const STATUS_GROUP_NAMES = {
      overdue: 'Quá hạn',
      warning: 'Sắp đến hạn',
      safe: 'An toàn / Chưa đến hạn',
      completed: 'Đã hoàn thành',
    };

    const isVisibleUnderCurrentFilter =
      (!activeStatusFilter || activeStatusFilter === targetGroup) &&
      (activeFilter === 'all' || activeFilter === savedItem.type || (activeFilter === 'urgent' && ['overdue', 'warning'].includes(targetGroup))) &&
      (!debouncedSearch || normalizeHabitSearch(`${savedItem.title || ''} ${savedItem.category || ''}`).includes(normalizeHabitSearch(debouncedSearch)));

    if (!isVisibleUnderCurrentFilter) {
      setActiveStatusFilter(targetGroup);
      setActiveFilter('all');
      setSearchInput('');
      setDebouncedSearch('');
      setToastMessage(`Việc đã chuyển sang nhóm ${STATUS_GROUP_NAMES[targetGroup] || targetGroup}`);
      setTimeout(() => setToastMessage(null), 2500);
    }

    setHighlightHabitId(savedItem.id);
    setTimeout(() => setHighlightHabitId(null), 2500);

    setModalVisible(false);
    setFormErrors({});
  };

  // Màu sắc theo urgency
  const getUrgencyColor = (urgency) => {
    if (urgency === 'overdue') return '#EF4444'; // Đỏ
    if (urgency === 'warning') return '#F59E0B'; // Vàng
    return '#10B981'; // Xanh
  };

  // Render từng thẻ việc vặt (Đã tối ưu bố cục 2 hàng rõ ràng, không tràn mép viền)
  const renderHabitItem = ({ item }) => {
    const { status } = item;
    const urgencyColor = getUrgencyColor(status.urgency);

    return (
      <View style={[styles.habitCard, { backgroundColor: colors.card, borderColor: item.id === highlightHabitId ? colors.primary : colors.cardBorder, borderWidth: item.id === highlightHabitId ? 2 : 1 }]}>
        {/* Header thẻ: Icon, Tên (tối đa 2 dòng không bị che), Nút Sửa, Nút Xóa */}
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconBox, { backgroundColor: (item.color || colors.primary) + '20' }]}>
            <Ionicons name={item.icon || 'repeat'} size={22} color={item.color || colors.primary} />
          </View>
          <View style={styles.cardTitleBox}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
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

        {/* HÀNG 1: Trạng thái đến hạn (Urgency status rõ ràng, chỉ thông tin hạn chót) */}
        <View style={styles.cardRow1}>
          <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor + '20', borderColor: urgencyColor }]}>
            <View style={[styles.urgencyDot, { backgroundColor: urgencyColor }]} />
            <Text style={[styles.urgencyText, { color: urgencyColor }]}>
              {status.statusText}
            </Text>
          </View>
        </View>

        {/* HÀNG 2: Thông tin phụ (Wrap linh hoạt, gap đều, maxWidth an toàn không bao giờ tràn viền) */}
        <View style={styles.cardRow2}>
          {/* Badge Chu kỳ lặp */}
          <View style={[styles.infoChip, { backgroundColor: HABIT_ATTRIBUTE_COLORS.cycle.background, borderColor: HABIT_ATTRIBUTE_COLORS.cycle.border }]}>
            <Ionicons
              name={item.type === HABIT_TYPES.MONTHLY ? 'calendar-outline' : item.type === HABIT_TYPES.DAILY ? 'trophy-outline' : 'repeat-outline'}
              size={13}
              color={HABIT_ATTRIBUTE_COLORS.cycle.text}
            />
            <Text style={[styles.infoChipText, { color: HABIT_ATTRIBUTE_COLORS.cycle.text }]}>
              {status.cycleInfo}
            </Text>
          </View>

          {/* Huy hiệu nhắc nhở theo giờ (bấm để bật/tắt nhanh) */}
          <Pressable
            onPress={() => handleQuickToggleReminder(item)}
            hitSlop={6}
            style={[
              styles.infoChip,
              {
                backgroundColor: item.reminderEnabled ? HABIT_ATTRIBUTE_COLORS.reminder.background : colors.cardElevated,
                borderColor: item.reminderEnabled ? HABIT_ATTRIBUTE_COLORS.reminder.border : colors.cardBorder,
              },
            ]}
          >
            <Ionicons
              name={item.reminderEnabled ? 'notifications' : 'notifications-off-outline'}
              size={13}
              color={item.reminderEnabled ? HABIT_ATTRIBUTE_COLORS.reminder.text : colors.sub}
            />
            <Text
              style={[
                styles.infoChipText,
                { color: item.reminderEnabled ? HABIT_ATTRIBUTE_COLORS.reminder.text : colors.sub, fontWeight: item.reminderEnabled ? '700' : '500' },
              ]}
            >
              {item.reminderEnabled ? item.reminderTime || '08:00' : 'Tắt'}
            </Text>
          </Pressable>

          {/* Huy hiệu số lần đã hoàn thành (nhãn rõ ràng: Đã làm X lần) */}
          {item.history && item.history.length > 0 && (
            <Pressable
              onPress={() => {
                setSelectedHabitForHistory(item);
                setHistoryModalVisible(true);
              }}
              hitSlop={6}
              style={[styles.infoChip, { backgroundColor: HABIT_ATTRIBUTE_COLORS.count.background, borderColor: HABIT_ATTRIBUTE_COLORS.count.border }]}
            >
              <Ionicons name="time-outline" size={13} color={HABIT_ATTRIBUTE_COLORS.count.text} />
              <Text style={[styles.infoChipText, { color: HABIT_ATTRIBUTE_COLORS.count.text }]}>
                Đã làm {item.history.length} lần
              </Text>
            </Pressable>
          )}

          {/* Badge Danh mục */}
          {item.category ? (
            <View style={[styles.infoChip, { backgroundColor: `${item.color || '#64748B'}26`, borderColor: `${item.color || '#64748B'}80` }]}>
              <Ionicons name="pricetag-outline" size={12} color={item.color || '#94A3B8'} />
              <Text style={[styles.infoChipText, { color: item.color || '#94A3B8' }]}>{item.category}</Text>
            </View>
          ) : null}
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
                  {status.isCompleted ? 'Đã đạt mục tiêu' : `Tăng 1 ${item.unit || 'lần'} (${status.currentCount}/${status.targetCount})`}
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
      {toastMessage ? (
        <View style={styles.toastPill}>
          <Ionicons name="information-circle" size={16} color="#FFFFFF" />
          <Text style={styles.toastPillText}>{toastMessage}</Text>
        </View>
      ) : null}
      <ScreenHeader
        title="Chu kỳ việc vặt"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <FlatList
        ref={listRef}
        data={filteredHabits}
        keyExtractor={(item) => item.id}
        renderItem={renderHabitItem}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        onScrollToIndexFailed={({ index, averageItemLength }) => listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Thẻ Thống kê Tổng quan */}
            <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.statsHeader}>
                <View style={styles.statsActionsRow}>
                  <Pressable
                    onPress={handleOpenDebugNotifs}
                    style={[styles.debugNotifTopBtn, { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder }]}
                    accessibilityLabel="Kiểm tra lịch báo hệ điều hành"
                  >
                    <Ionicons name="notifications-outline" size={13} color={colors.sub} />
                  </Pressable>
                  <Pressable
                    onPress={handleOpenAiModal}
                    style={[styles.aiSuggestTopBtn, { backgroundColor: '#7C3AED' }]}
                  >
                    <Ionicons name="sparkles" size={13} color="#FFFFFF" />
                    <Text style={styles.aiSuggestTopBtnText}>AI Gợi ý</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleOpenAddModal}
                    style={[styles.addTopBtn, { backgroundColor: '#10B981' }]}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.addTopBtnText}>Thêm việc</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveStatusFilter((current) => current === 'overdue' ? null : 'overdue')}
                  style={[styles.statBox, { backgroundColor: activeStatusFilter === 'overdue' ? 'rgba(239, 68, 68, 0.24)' : 'rgba(239, 68, 68, 0.1)', borderColor: activeStatusFilter === 'overdue' ? '#EF4444' : 'transparent' }]}
                >
                  <Text style={[styles.statNumber, { color: '#EF4444' }]}>{stats.overdue}</Text>
                  <Text style={[styles.statLabel, { color: colors.sub }]} numberOfLines={1} adjustsFontSizeToFit>Quá hạn</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveStatusFilter((current) => current === 'warning' ? null : 'warning')}
                  style={[styles.statBox, { backgroundColor: activeStatusFilter === 'warning' ? 'rgba(245, 158, 11, 0.24)' : 'rgba(245, 158, 11, 0.1)', borderColor: activeStatusFilter === 'warning' ? '#F59E0B' : 'transparent' }]}
                >
                  <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{stats.warning}</Text>
                  <Text style={[styles.statLabel, { color: colors.sub }]} numberOfLines={1} adjustsFontSizeToFit>Sắp đến hạn</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveStatusFilter((current) => current === 'safe' ? null : 'safe')}
                  style={[styles.statBox, { backgroundColor: activeStatusFilter === 'safe' ? 'rgba(16, 185, 129, 0.24)' : 'rgba(16, 185, 129, 0.1)', borderColor: activeStatusFilter === 'safe' ? '#10B981' : 'transparent' }]}
                >
                  <Text style={[styles.statNumber, { color: '#10B981' }]}>{stats.safe}</Text>
                  <Text style={[styles.statLabel, { color: colors.sub }]} numberOfLines={1} adjustsFontSizeToFit>Chưa đến hạn</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveStatusFilter((current) => current === 'completed' ? null : 'completed')}
                  style={[styles.statBox, { backgroundColor: activeStatusFilter === 'completed' ? 'rgba(99, 102, 241, 0.24)' : colors.cardElevated, borderColor: activeStatusFilter === 'completed' ? '#818CF8' : 'transparent' }]}
                >
                  <Text style={[styles.statNumber, { color: '#A5B4FC' }]}>{stats.completed}</Text>
                  <Text style={[styles.statLabel, { color: colors.sub }]} numberOfLines={1} adjustsFontSizeToFit>Đã xong</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="search-outline" size={19} color={colors.sub} />
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Tìm tên việc..."
                placeholderTextColor={colors.sub}
                style={[styles.searchInput, { color: colors.text }]}
                returnKeyType="search"
                accessibilityLabel="Tìm tên việc hoặc danh mục"
              />
              {searchInput ? <Pressable onPress={() => setSearchInput('')} hitSlop={8}><Ionicons name="close-circle" size={19} color={colors.sub} /></Pressable> : null}
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
            {hasActiveFilters ? (
              <View style={styles.filterSummaryRow}>
                <Text style={[styles.filterSummaryText, { color: colors.sub }]} numberOfLines={1}>
                  {[activeStatusFilter === 'overdue' ? 'Quá hạn' : activeStatusFilter === 'warning' ? 'Sắp đến hạn' : activeStatusFilter === 'safe' ? 'Chưa đến hạn' : null, activeFilter !== 'all' ? FILTER_TABS.find((tab) => tab.id === activeFilter)?.label : null, debouncedSearch ? `“${debouncedSearch}”` : null, `${filteredHabits.length} việc`].filter(Boolean).join(' · ')}
                </Text>
                <Pressable onPress={clearFilters} hitSlop={8}><Text style={{ color: colors.primary, fontWeight: '800' }}>Xóa lọc</Text></Pressable>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.sub} />
            <Text style={[styles.emptyText, { color: colors.sub }]}>
              Không có việc nào phù hợp
            </Text>
            {hasActiveFilters ? <Pressable onPress={clearFilters} style={[styles.emptyClearButton, { borderColor: colors.primary }]}><Text style={{ color: colors.primary, fontWeight: '800' }}>Xóa lọc</Text></Pressable> : null}
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
                    style={[styles.input, { color: colors.text, borderColor: formErrors.title ? '#EF4444' : colors.border }]}
                    value={formTitle}
                    onChangeText={(t) => { setFormTitle(t); setFormErrors((e) => ({ ...e, title: undefined })); }}
                    placeholder="VD: Thay nhớt xe, Đóng tiền trọ, Uống thuốc..."
                    placeholderTextColor={colors.sub}
                    autoCapitalize="sentences"
                    maxLength={60}
                  />
                  <Text style={[styles.charCount, { color: colors.sub }]}>{formTitle.length}/60</Text>
                  {formErrors.title ? <Text style={styles.errorText}>{formErrors.title}</Text> : null}

                  {/* Thiết lập tham số chu kỳ tương ứng (Toàn bộ bộ chọn trực quan - CẤM nhập tay số) */}
                  {formType === HABIT_TYPES.INTERVAL && (
                    <View style={styles.formSectionBox}>
                      <Text style={[styles.fieldLabel, { color: colors.text }]}>Chu kỳ lặp lại (Chọn hoặc Tăng/Giảm)</Text>
                      {/* Chips chọn nhanh */}
                      <View style={styles.chipRow}>
                        {INTERVAL_PRESETS.map((days) => {
                          const isSelected = parseInt(formIntervalDays, 10) === days;
                          return (
                            <Pressable
                              key={days}
                              onPress={() => {
                                setFormIntervalDays(String(days));
                                setFormErrors((e) => ({ ...e, intervalDays: undefined }));
                              }}
                              style={[
                                styles.presetChip,
                                {
                                  backgroundColor: isSelected ? '#10B981' : colors.cardElevated,
                                  borderColor: isSelected ? '#10B981' : colors.cardBorder,
                                },
                              ]}
                            >
                              <Text style={[styles.presetChipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                                {days} ngày
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Bộ Stepper Tinh Chỉnh [-5] [-1] [Hiển thị] [+1] [+5] */}
                      <View style={styles.stepperContainer}>
                        <Pressable
                          onPress={() => setFormIntervalDays((prev) => String(Math.max(1, parseInt(prev || '1', 10) - 5)))}
                          style={[styles.stepperMiniBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                        >
                          <Text style={[styles.stepperMiniBtnText, { color: colors.text }]}>-5</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setFormIntervalDays((prev) => String(Math.max(1, parseInt(prev || '1', 10) - 1)))}
                          style={[styles.stepperMiniBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                        >
                          <Ionicons name="remove" size={18} color={colors.text} />
                        </Pressable>

                        <View style={[styles.stepperDisplay, { backgroundColor: colors.card, borderColor: '#10B981' }]}>
                          <Text style={[styles.stepperDisplayText, { color: colors.text }]}>
                            {formIntervalDays} <Text style={{ fontSize: 13, color: colors.sub }}>ngày</Text>
                          </Text>
                        </View>

                        <Pressable
                          onPress={() => setFormIntervalDays((prev) => String(Math.min(3650, parseInt(prev || '1', 10) + 1)))}
                          style={[styles.stepperMiniBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                        >
                          <Ionicons name="add" size={18} color={colors.text} />
                        </Pressable>
                        <Pressable
                          onPress={() => setFormIntervalDays((prev) => String(Math.min(3650, parseInt(prev || '1', 10) + 5)))}
                          style={[styles.stepperMiniBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                        >
                          <Text style={[styles.stepperMiniBtnText, { color: colors.text }]}>+5</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {formType === HABIT_TYPES.MONTHLY && (
                    <View style={styles.formSectionBox}>
                      <Text style={[styles.fieldLabel, { color: colors.text }]}>
                        Ngày đến hạn hàng tháng (Chọn 1 trong 31 ngày)
                      </Text>
                      {/* Lưới 31 ô chọn ngày (1–31) */}
                      <View style={styles.daysGrid}>
                        {DAYS_OF_MONTH.map((d) => {
                          const isSelected = parseInt(formDayOfMonth, 10) === d;
                          return (
                            <Pressable
                              key={d}
                              onPress={() => {
                                setFormDayOfMonth(String(d));
                                setFormErrors((e) => ({ ...e, dayOfMonth: undefined }));
                              }}
                              style={[
                                styles.dayGridCell,
                                {
                                  backgroundColor: isSelected ? '#10B981' : colors.cardElevated,
                                  borderColor: isSelected ? '#10B981' : colors.cardBorder,
                                },
                              ]}
                            >
                              <Text style={[styles.dayGridCellText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                                {d}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View style={[styles.noteBox, { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder }]}>
                        <Ionicons name="information-circle-outline" size={16} color="#10B981" />
                        <Text style={[styles.noteBoxText, { color: colors.sub }]}>
                          Với tháng ngắn (tháng 2, 4, 6, 9, 11), hệ thống sẽ tự động chọn ngày cuối cùng của tháng đó (VD: ngày 31 tháng 2 tự chuyển thành 28/29).
                        </Text>
                      </View>
                    </View>
                  )}

                  {formType === HABIT_TYPES.DAILY && (
                    <View style={styles.formSectionBox}>
                      <Text style={[styles.fieldLabel, { color: colors.text }]}>Mục tiêu số lần mỗi ngày</Text>
                      {/* Chips chọn nhanh */}
                      <View style={styles.chipRow}>
                        {DAILY_PRESETS.map((cnt) => {
                          const isSelected = parseInt(formTargetCount, 10) === cnt;
                          return (
                            <Pressable
                              key={cnt}
                              onPress={() => {
                                setFormTargetCount(String(cnt));
                                setFormErrors((e) => ({ ...e, targetCount: undefined }));
                              }}
                              style={[
                                styles.presetChip,
                                {
                                  backgroundColor: isSelected ? '#10B981' : colors.cardElevated,
                                  borderColor: isSelected ? '#10B981' : colors.cardBorder,
                                },
                              ]}
                            >
                              <Text style={[styles.presetChipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                                {cnt} lần
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Stepper điều chỉnh số lần */}
                      <View style={styles.stepperContainer}>
                        <Pressable
                          onPress={() => setFormTargetCount((prev) => String(Math.max(1, parseInt(prev || '1', 10) - 1)))}
                          style={[styles.stepperMiniBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                        >
                          <Ionicons name="remove" size={18} color={colors.text} />
                        </Pressable>
                        <View style={[styles.stepperDisplay, { backgroundColor: colors.card, borderColor: '#10B981' }]}>
                          <Text style={[styles.stepperDisplayText, { color: colors.text }]}>
                            {formTargetCount} <Text style={{ fontSize: 13, color: colors.sub }}>{formUnit || 'lần'}</Text>
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => setFormTargetCount((prev) => String(Math.min(9999, parseInt(prev || '1', 10) + 1)))}
                          style={[styles.stepperMiniBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                        >
                          <Ionicons name="add" size={18} color={colors.text} />
                        </Pressable>
                      </View>

                      {/* Đơn vị tính */}
                      <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 8 }]}>Đơn vị tính</Text>
                      <View style={styles.chipWrap}>
                        {DAILY_UNITS.map((unit) => (
                          <Pressable key={unit} onPress={() => setFormUnit(unit)} style={[styles.choiceChip, { borderColor: formUnit === unit ? '#10B981' : colors.border, backgroundColor: formUnit === unit ? 'rgba(16,185,129,0.15)' : colors.card }]}>
                            <Text style={{ color: formUnit === unit ? '#10B981' : colors.sub, fontWeight: '700' }}>{unit}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* THIẾT LẬP THÔNG BÁO NHẮC NHỞ THEO GIỜ (BỘ CHỌN NATIVE TIME PICKER) */}
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
                        {/* Nút hiển thị giờ nhắc - Bấm để mở Native Time Picker */}
                        <Text style={[styles.subPickerTitle, { color: colors.text }]}>Khung giờ báo thức</Text>
                        <Pressable
                          onPress={() => setShowTimePicker(true)}
                          style={[styles.timePickerBtn, { backgroundColor: colors.card, borderColor: '#10B981' }]}
                        >
                          <Ionicons name="alarm-outline" size={26} color="#10B981" />
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.timePickerVal, { color: colors.text }]}>
                              {formReminderTime}
                            </Text>
                            <Text style={[styles.timePickerSub, { color: colors.sub }]}>
                              {formType === HABIT_TYPES.DAILY ? 'Báo mỗi ngày lúc giờ này' : 'Báo vào ngày đến hạn lúc giờ này'}
                            </Text>
                          </View>
                          <View style={[styles.changeTimeBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                            <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700' }}>Đổi giờ</Text>
                          </View>
                        </Pressable>

                        {/* Native DateTimePicker cho iOS và Android */}
                        {showTimePicker && (
                          Platform.OS === 'ios' ? (
                            <Modal visible={showTimePicker} transparent animationType="fade">
                              <View style={styles.timePickerModalOverlay}>
                                <View style={[styles.timePickerModalBox, { backgroundColor: colors.card }]}>
                                  <View style={styles.timePickerModalHeader}>
                                    <Text style={[styles.timePickerModalTitle, { color: colors.text }]}>Chọn giờ nhắc</Text>
                                    <Pressable onPress={() => setShowTimePicker(false)}>
                                      <Ionicons name="close" size={22} color={colors.sub} />
                                    </Pressable>
                                  </View>
                                  <DateTimePicker
                                    value={pickerDate}
                                    mode="time"
                                    is24Hour
                                    display="spinner"
                                    textColor={colors.text}
                                    onChange={handleTimePickerChange}
                                  />
                                  <Pressable
                                    onPress={() => setShowTimePicker(false)}
                                    style={[styles.timePickerModalDone, { backgroundColor: '#10B981' }]}
                                  >
                                    <Text style={styles.timePickerModalDoneText}>Xác nhận giờ</Text>
                                  </Pressable>
                                </View>
                              </View>
                            </Modal>
                          ) : (
                            <DateTimePicker
                              value={pickerDate}
                              mode="time"
                              is24Hour
                              display="default"
                              onChange={handleTimePickerChange}
                            />
                          )
                        )}

                        {/* Dòng xem trước từ hàm duy nhất computeNextOccurrence (VIỆC AE) */}
                        {occurrencePreview?.previewText ? (
                          <View style={[styles.previewBox, { backgroundColor: colors.card, borderColor: '#10B981' }]}>
                            <Ionicons name="time-outline" size={16} color="#10B981" />
                            <Text style={[styles.previewText, { color: colors.text }]}>
                              {occurrencePreview.previewText}
                            </Text>
                          </View>
                        ) : null}

                        {/* Tùy chọn khi giờ nhắc đã qua hôm nay (VIỆC AE) */}
                        {occurrencePreview?.passedToday && formType === HABIT_TYPES.DAILY ? (
                          <View style={{ marginTop: 10 }}>
                            <Text style={[styles.fieldSubLabel, { color: colors.sub }]}>Tùy chọn bắt đầu theo dõi:</Text>
                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                              <Pressable
                                onPress={() => setFormStartDate(getTodayDateString())}
                                style={[
                                  styles.choiceChip,
                                  {
                                    flex: 1,
                                    borderColor: formStartDate === getTodayDateString() || !formStartDate ? '#10B981' : colors.border,
                                    backgroundColor: formStartDate === getTodayDateString() || !formStartDate ? 'rgba(16,185,129,0.15)' : colors.card,
                                  },
                                ]}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '700', color: formStartDate === getTodayDateString() || !formStartDate ? '#10B981' : colors.sub }}>
                                  Tính từ hôm nay (theo dõi tiến độ, nhắc từ ngày mai)
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  const tom = new Date();
                                  tom.setDate(tom.getDate() + 1);
                                  setFormStartDate(getTodayDateString(tom));
                                }}
                                style={[
                                  styles.choiceChip,
                                  {
                                    flex: 1,
                                    borderColor: formStartDate && formStartDate > getTodayDateString() ? '#10B981' : colors.border,
                                    backgroundColor: formStartDate && formStartDate > getTodayDateString() ? 'rgba(16,185,129,0.15)' : colors.card,
                                  },
                                ]}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '700', color: formStartDate && formStartDate > getTodayDateString() ? '#10B981' : colors.sub }}>
                                  Bắt đầu từ ngày mai (hôm nay không tính)
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : null}

                        {/* Cho việc Theo ngày (INTERVAL) và Hàng tháng (MONTHLY): Bộ chọn ngày bắt đầu / đến hạn kế tiếp (VIỆC AE) */}
                        {(formType === HABIT_TYPES.INTERVAL || formType === HABIT_TYPES.MONTHLY) ? (
                          <View style={{ marginTop: 10 }}>
                            <Text style={[styles.subPickerTitle, { color: colors.text }]}>Ngày bắt đầu / đến hạn kế tiếp</Text>
                            <Pressable
                              onPress={() => setShowStartDatePicker(true)}
                              style={[styles.timePickerBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 4 }]}
                            >
                              <Ionicons name="calendar-outline" size={22} color="#3B82F6" />
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={[styles.timePickerVal, { color: colors.text, fontSize: 15 }]}>
                                  {formStartDate ? new Date(formStartDate).toLocaleDateString('vi-VN') : 'Mặc định theo chu kỳ'}
                                </Text>
                                <Text style={[styles.timePickerSub, { color: colors.sub }]}>
                                  {occurrencePreview?.dueDate ? `Kỳ tiếp theo: ${new Date(occurrencePreview.dueDate).toLocaleDateString('vi-VN')}` : 'Tự động tính'}
                                </Text>
                              </View>
                              <View style={[styles.changeTimeBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                                <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '700' }}>Chọn ngày</Text>
                              </View>
                            </Pressable>

                            {/* Hiển thị giải thích tự động đẩy chu kỳ nếu người dùng chọn ngày trong quá khứ */}
                            {occurrencePreview?.explanation ? (
                              <View style={[styles.explanationBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' }]}>
                                <Ionicons name="information-circle" size={16} color="#F59E0B" />
                                <Text style={{ color: '#F59E0B', fontSize: 12, flex: 1, marginLeft: 6, fontWeight: '600' }}>
                                  {occurrencePreview.explanation}
                                </Text>
                              </View>
                            ) : null}

                            {showStartDatePicker ? (
                              <DateTimePicker
                                value={formStartDate ? new Date(formStartDate) : new Date()}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, selectedDate) => {
                                  setShowStartDatePicker(false);
                                  if (selectedDate) {
                                    setFormStartDate(getTodayDateString(selectedDate));
                                  }
                                }}
                              />
                            ) : null}
                          </View>
                        ) : null}

                        {/* Nút bắn thông báo thử nghiệm ngay (2s) để test loa & banner trên iOS & Android */}
                        <Pressable
                          onPress={handleTestNotification}
                          style={[styles.testNotifBtn, { backgroundColor: colors.card, borderColor: '#10B981' }]}
                        >
                          <Ionicons name="notifications-circle" size={18} color="#10B981" />
                          <Text style={styles.testNotifBtnText}>🔔 Thử chuông thông báo ngay (2s)</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {/* Danh mục */}
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Nhóm / Danh mục</Text>
                  <View style={styles.chipWrap}>
                    {CATEGORIES.map((category) => (
                      <Pressable key={category} onPress={() => { setFormCategory(category); setFormErrors((e) => ({ ...e, category: undefined })); }} style={[styles.choiceChip, { borderColor: formCategory === category ? '#10B981' : colors.border, backgroundColor: formCategory === category ? 'rgba(16,185,129,0.15)' : colors.card }]}>
                        <Text style={{ color: formCategory === category ? '#10B981' : colors.sub, fontWeight: '700' }}>{category}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {customCategories.length ? <View style={styles.customCategoryRow}>
                    {customCategories.map((category) => <View key={category} style={[styles.choiceChip, { flexDirection: 'row', gap: 4, borderColor: colors.border }]}>
                      <Pressable onPress={() => { setFormCategory('Khác'); setFormCustomCategory(category); }}><Text style={{ color: colors.sub, fontWeight: '700' }}>{category}</Text></Pressable>
                      <Pressable onPress={async () => { const next = customCategories.filter((item) => item !== category); setCustomCategories(next); await saveCustomCategories(next); }} hitSlop={6}><Ionicons name="close" size={14} color={colors.sub} /></Pressable>
                    </View>)}
                  </View> : null}
                  {formCategory === 'Khác' ? <>
                    <TextInput
                      autoFocus
                      value={formCustomCategory}
                      onChangeText={(text) => { setFormCustomCategory(text); setFormErrors((e) => ({ ...e, category: undefined })); }}
                      maxLength={20}
                      placeholder="Tên danh mục"
                      placeholderTextColor={colors.sub}
                      style={[styles.input, { color: colors.text, borderColor: formErrors.category ? '#EF4444' : colors.border, marginTop: 8 }]}
                    />
                    {formErrors.category ? <Text style={styles.errorText}>{formErrors.category}</Text> : null}
                  </> : null}

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
                    disabled={!isFormValid}
                    style={[styles.saveBtn, { backgroundColor: isFormValid ? '#10B981' : '#6B7280', opacity: isFormValid ? 1 : 0.5 }]}
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

      {/* Modal Gợi ý chu kỳ việc vặt bằng Gemini AI */}
      <Modal
        visible={aiModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAiModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.aiModalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={22} color="#7C3AED" />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Gemini AI Gợi ý việc vặt
                </Text>
              </View>
              <Pressable onPress={() => setAiModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.sub} />
              </Pressable>
            </View>

            <FlatList
              data={[1]}
              keyExtractor={() => 'ai-content'}
              showsVerticalScrollIndicator={false}
              renderItem={() => (
                <View style={{ paddingBottom: 16 }}>
                  <Text style={[styles.aiIntroText, { color: colors.sub }]}>
                    Chọn chủ đề nhanh hoặc nhập nhu cầu sinh hoạt thực tế của bạn để Gemini AI tự động lên lịch chu kỳ tối ưu (100% miễn phí).
                  </Text>

                  {/* Nhóm chủ đề nhanh */}
                  <View style={styles.aiTopicChipsRow}>
                    {[
                      { label: '🎓 Sinh viên ở trọ', prompt: 'Sinh viên ở trọ phòng riêng' },
                      { label: '🛵 Bảo dưỡng xe máy', prompt: 'Bảo dưỡng xe máy tay ga định kỳ' },
                      { label: '🩺 Sức khỏe sinh hoạt', prompt: 'Sức khỏe, uống nước, tập thể dục' },
                      { label: '🐾 Nuôi thú cưng', prompt: 'Nuôi mèo và chó trong nhà' },
                      { label: '🏠 Nhà cửa & Gas', prompt: 'Gia đình, nhà cửa, đổi gas, lọc nước' },
                    ].map((topic) => (
                      <Pressable
                        key={topic.label}
                        onPress={() => {
                          setAiPrompt(topic.prompt);
                          handleGenerateAiHabits(topic.prompt);
                        }}
                        style={[styles.aiTopicChip, { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder }]}
                      >
                        <Text style={[styles.aiTopicChipText, { color: colors.text }]}>{topic.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Ô nhập tùy biến */}
                  <View style={styles.aiInputRow}>
                    <TextInput
                      style={[styles.aiCustomInput, { color: colors.text, borderColor: colors.cardBorder }]}
                      value={aiPrompt}
                      onChangeText={setAiPrompt}
                      placeholder="VD: Người mới mua xe tay ga, sống 1 mình..."
                      placeholderTextColor={colors.sub}
                      returnKeyType="done"
                      onSubmitEditing={() => handleGenerateAiHabits()}
                    />
                    <Pressable
                      onPress={() => handleGenerateAiHabits()}
                      disabled={isGeneratingAi}
                      style={[styles.aiGenerateBtn, { backgroundColor: '#7C3AED', opacity: isGeneratingAi ? 0.6 : 1 }]}
                    >
                      {isGeneratingAi ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                      )}
                    </Pressable>
                  </View>

                  {/* Danh sách gợi ý từ Gemini AI */}
                  {aiSuggestions.length > 0 && (
                    <View style={styles.aiResultsContainer}>
                      <Text style={[styles.aiResultsTitle, { color: colors.text }]}>
                        Đã tạo {aiSuggestions.length} việc vặt thông minh:
                      </Text>

                      {aiSuggestions.map((item, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.aiSuggestionCard,
                            { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder },
                          ]}
                        >
                          <View style={[styles.aiCardColorBar, { backgroundColor: item.color || '#3B82F6' }]} />
                          <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12 }}>
                            <Text style={[styles.aiCardTitle, { color: colors.text }]}>{item.title}</Text>
                            <Text style={[styles.aiCardSubtitle, { color: colors.sub }]}>
                              {item.type === 'interval' && `Lặp lại mỗi ${item.intervalDays} ngày`}
                              {item.type === 'monthly' && `Ngày ${item.dayOfMonth} hàng tháng`}
                              {item.type === 'daily' && `Mỗi ngày ${item.targetCount} ${item.unit || 'lần'}`}
                              {item.reminderTime ? ` • Nhắc lúc ${item.reminderTime}` : ''}
                            </Text>
                          </View>
                        </View>
                      ))}

                      {/* Nút áp dụng tất cả */}
                      <Pressable
                        onPress={handleApplyAiHabits}
                        style={[styles.applyAiBtn, { backgroundColor: '#10B981' }]}
                      >
                        <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                        <Text style={styles.applyAiBtnText}>
                          Thêm tất cả vào danh sách (+{aiSuggestions.length})
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Debug Toàn Bộ Thông Báo OS Đã Lên Lịch (VIỆC 5) */}
      <Modal
        visible={debugNotifModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDebugNotifModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="notifications-circle" size={22} color="#10B981" />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Lịch báo hệ điều hành ({scheduledNotifs.length})
                </Text>
              </View>
              <Pressable onPress={() => setDebugNotifModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.sub} />
              </Pressable>
            </View>

            <FlatList
              data={scheduledNotifs}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable onPress={() => handleSimulateNotificationTap(item.taskId)} style={[styles.debugNotifCard, { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="alarm" size={16} color="#10B981" />
                    <Text style={[styles.debugNotifTitle, { color: colors.text }]}>{item.title}</Text>
                  </View>
                  <Text style={[styles.debugNotifBody, { color: colors.sub }]}>{item.body}</Text>
                  <View style={styles.debugNotifMetaRow}>
                    <Text style={[styles.debugNotifTrigger, { color: '#10B981' }]}>⏰ {item.triggerSummary}</Text>
                    <Text style={[styles.debugNotifId, { color: colors.sub }]}>ID: {item.id.slice(0, 8)}...</Text>
                  </View>
                  {item.nextAt ? <Text style={[styles.debugNotifBody, { color: colors.sub }]}>Lần kế tiếp: {new Date(item.nextAt).toLocaleString('vi-VN')}</Text> : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                  <Ionicons name="notifications-off-outline" size={44} color={colors.sub} />
                  <Text style={[styles.emptyText, { color: colors.sub }]}>
                    Hiện chưa có thông báo nào được đặt lịch. Bật công tắc chuông trên việc vặt để kiểm tra.
                  </Text>
                </View>
              }
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={handleSelfHealNotifications}
                style={[styles.saveBtn, { flex: 1, backgroundColor: '#3B82F6', marginTop: 0 }]}
              >
                <Text style={styles.saveBtnText}>Tự đối chiếu & Sửa</Text>
              </Pressable>
              <Pressable
                onPress={() => setDebugNotifModalVisible(false)}
                style={[styles.saveBtn, { flex: 1, backgroundColor: '#10B981', marginTop: 0 }]}
              >
                <Text style={styles.saveBtnText}>Đóng</Text>
              </Pressable>
            </View>
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
  statsHeader: { gap: 10, marginBottom: 12 },
  statsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statsTitle: { fontSize: 14, fontWeight: '800' },
  statsActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' },
  aiSuggestTopBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
  },
  aiSuggestTopBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  keyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
  },
  keyBtnText: {
    fontSize: 11, fontWeight: '700', color: '#7C3AED',
  },
  addTopBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
  },
  addTopBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  statNumber: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // Tabs
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  filterTab: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1,
  },
  filterTabText: { fontSize: 12, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, minHeight: 44, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  filterSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -6, marginBottom: 12 },
  filterSummaryText: { flex: 1, fontSize: 12, fontWeight: '600' },

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

  // Card 2 Rows layout (VIỆC 2)
  cardRow1: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
  },
  cardRow2: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', maxWidth: '100%', marginBottom: 10,
  },
  urgencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
  },
  urgencyDot: { width: 7, height: 7, borderRadius: 4 },
  urgencyText: { fontSize: 13, fontWeight: '800' },
  infoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
  },
  infoChipText: { fontSize: 12 },

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
  emptyClearButton: { marginTop: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },

  // Debug Notification in header (VIỆC 5)
  debugNotifTopBtn: {
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1,
  },
  debugNotifTopBtnText: { fontSize: 11, fontWeight: '700' },

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
  errorText: {
    color: '#EF4444', fontSize: 11, fontWeight: '600', marginTop: 3, marginLeft: 4,
  },
  charCount: { fontSize: 11, alignSelf: 'flex-end', marginTop: 3 },
  toastPill: {
    position: 'absolute', top: 56, alignSelf: 'center', zIndex: 9999,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  toastPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Form Selector Elements (VIỆC 1)
  formSectionBox: { marginVertical: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  customCategoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  choiceChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  presetChip: {
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
  },
  presetChipText: { fontSize: 12, fontWeight: '700' },

  stepperContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  stepperMiniBtn: {
    minWidth: 42, height: 40, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
  },
  stepperMiniBtnText: { fontSize: 13, fontWeight: '800' },
  stepperDisplay: {
    flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperDisplayText: { fontSize: 15, fontWeight: '800' },

  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  dayGridCell: {
    width: '12%', aspectRatio: 1, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  dayGridCellText: { fontSize: 12, fontWeight: '700' },

  noteBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8,
    borderRadius: 8, borderWidth: 1, marginTop: 6,
  },
  noteBoxText: { fontSize: 11, flex: 1, lineHeight: 15 },

  // Reminder section in modal
  reminderSection: {
    borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 14,
  },
  previewBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10,
    borderRadius: 10, borderWidth: 1, marginTop: 8,
  },
  previewText: { fontSize: 12, fontWeight: '700', flex: 1 },
  explanationBox: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    borderRadius: 10, borderWidth: 1, marginTop: 8,
  },
  fieldSubLabel: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  reminderHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  reminderSectionTitle: { fontSize: 13, fontWeight: '800' },
  reminderBody: { marginTop: 10 },

  subPickerTitle: {
    fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 4,
  },
  timePickerBtn: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 12, borderWidth: 1.5, marginTop: 4,
  },
  timePickerVal: { fontSize: 18, fontWeight: '800' },
  timePickerSub: { fontSize: 11, marginTop: 2 },
  changeTimeBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  timePickerModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  timePickerModalBox: {
    width: '100%', maxWidth: 360, borderRadius: 18, padding: 20,
  },
  timePickerModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  timePickerModalTitle: { fontSize: 16, fontWeight: '800' },
  timePickerModalDone: {
    paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 14,
  },
  timePickerModalDoneText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  // Test Notification Button
  testNotifBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginTop: 12,
  },
  testNotifBtnText: {
    color: '#10B981', fontSize: 13, fontWeight: '800',
  },

  // Debug Notification Modal Items (VIỆC 5)
  debugNotifCard: {
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8,
  },
  debugNotifTitle: { fontSize: 14, fontWeight: '800' },
  debugNotifBody: { fontSize: 12, marginTop: 2 },
  debugNotifMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  debugNotifTrigger: { fontSize: 11, fontWeight: '700' },
  debugNotifId: { fontSize: 10 },

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

  // Gemini AI Modal Styles
  aiModalCard: {
    width: '100%', maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingTop: 16,
  },
  aiIntroText: {
    fontSize: 13, lineHeight: 18, marginBottom: 12,
  },
  aiTopicChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14,
  },
  aiTopicChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  aiTopicChipText: {
    fontSize: 12, fontWeight: '700',
  },
  aiInputRow: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  aiCustomInput: {
    flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14,
  },
  aiGenerateBtn: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  aiResultsContainer: {
    marginTop: 6,
  },
  aiResultsTitle: {
    fontSize: 14, fontWeight: '800', marginBottom: 10,
  },
  aiSuggestionCard: {
    flexDirection: 'row', borderRadius: 12, borderWidth: 1,
    overflow: 'hidden', marginBottom: 8,
  },
  aiCardColorBar: {
    width: 6,
  },
  aiCardTitle: {
    fontSize: 14, fontWeight: '800', marginBottom: 2,
  },
  aiCardSubtitle: {
    fontSize: 12, fontWeight: '500',
  },
  applyAiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, marginTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  applyAiBtnText: {
    color: '#FFFFFF', fontSize: 14, fontWeight: '800',
  },
});
