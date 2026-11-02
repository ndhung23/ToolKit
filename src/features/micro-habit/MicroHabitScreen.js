// src/features/micro-habit/MicroHabitScreen.js
// Màn hình theo dõi việc vặt & Chu kỳ sinh hoạt (Micro-Habit & Refill Tracker)
// Tự động đếm ngược, cảnh báo màu sắc, hỗ trợ tùy chọn thông báo nhắc nhở theo giờ

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  FlatList,
  Platform,
  Keyboard,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';
import { useLanguage } from '../../i18n';
import { generateHabitsWithAi } from '../../services/geminiService';
import {
  HABIT_TYPES,
  calculateHabitStatus,
  getTodayDateString,
  getHabitStats,
  filterHabits,
  normalizeHabitSearch,
  DEFAULT_CATEGORIES,
  validateCategoryName,
  loadCustomCategories,
  saveCustomCategories,
  validateHabitTitle,
} from './microHabitService';
import {
  scheduleHabitReminder,
  cancelHabitReminder,
  testInstantNotification,
  getAllScheduledHabitReminders,
  reconcileHabitReminders,
} from './NotificationService';
import { requestOpenTask } from './TaskSheetStore';
import { ensureHabitsLoaded, setHabits as saveSharedHabits, subscribeHabits, recordHabitCompletion, undoHabitCompletion } from './HabitStore';
import { styles } from './microHabitStyles';
import HabitCard from './components/HabitCard';
import HabitFormModal from './components/HabitFormModal';
import HabitAiModal from './components/HabitAiModal';
import HabitHistoryModal from './components/HabitHistoryModal';
import HabitDebugNotifModal from './components/HabitDebugNotifModal';

const INTERVAL_PRESETS = [7, 14, 30, 60, 90, 180, 365];
const DAILY_PRESETS = [1, 2, 4, 8, 10];
const DAILY_UNITS = ['lần', 'cốc', 'viên', 'km'];
const CATEGORIES = [...DEFAULT_CATEGORIES, 'Khác'];
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);
const PRESET_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

export default function MicroHabitScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [habits, setHabits] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const listRef = useRef(null);
  const handledRouteHabitId = useRef(null);
  const [highlightHabitId, setHighlightHabitId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedHabitForHistory, setSelectedHabitForHistory] = useState(null);

  // Debug Thông báo OS
  const [debugNotifModalVisible, setDebugNotifModalVisible] = useState(false);
  const [scheduledNotifs, setScheduledNotifs] = useState([]);

  // Gemini AI Suggestion State
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
  const [formErrors, setFormErrors] = useState({});

  // Native Time Picker
  const [showTimePicker, setShowTimePicker] = useState(false);

  const filterTabs = useMemo(() => [
    { id: 'all', label: t('microHabit.tabAll') || 'Tất cả' },
    { id: 'urgent', label: t('microHabit.tabUrgent') || 'Khẩn cấp 🚨' },
    { id: 'interval', label: t('microHabit.tabInterval') || 'Theo ngày 🔄' },
    { id: 'monthly', label: t('microHabit.tabMonthly') || 'Hàng tháng 📅' },
    { id: 'daily', label: t('microHabit.tabDaily') || 'Trong ngày 🎯' },
  ], [t]);

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

  // Mở modal xem danh sách thông báo OS
  const handleOpenDebugNotifs = useCallback(async () => {
    const list = await getAllScheduledHabitReminders();
    setScheduledNotifs(list);
    setDebugNotifModalVisible(true);
  }, []);

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
        'Đã gửi thông báo thử',
        'Vui lòng vuốt từ mép trên màn hình hoặc khóa màn hình trong 2 giây để thấy banner thông báo.'
      );
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể gửi thông báo thử nghiệm.');
    }
  }, [editingId, habits, formTitle]);

  // Khởi tạo danh sách & đồng bộ
  useEffect(() => {
    let unsubscribe = () => {};
    const init = async () => {
      const loaded = await ensureHabitsLoaded();
      setHabits(loaded);
      const loadedCustomCats = await loadCustomCategories();
      setCustomCategories(loadedCustomCats);
      unsubscribe = subscribeHabits((freshHabits) => {
        setHabits(freshHabits);
      });
      reconcileHabitReminders(loaded).catch(() => {});
    };
    init();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const updateHabitsList = useCallback((newList) => {
    setHabits(newList);
    saveSharedHabits(newList);
  }, []);

  // Xử lý deep link / notification click
  useEffect(() => {
    const targetId = route.params?.targetHabitId;
    if (!targetId || habits.length === 0 || handledRouteHabitId.current === targetId) return;
    handledRouteHabitId.current = targetId;

    const targetIndex = habits.findIndex((h) => h.id === targetId);
    if (targetIndex !== -1) {
      setActiveFilter('all');
      setActiveStatusFilter(null);
      setSearchInput('');
      setHighlightHabitId(targetId);

      setTimeout(() => {
        try {
          listRef.current?.scrollToIndex({ index: targetIndex, animated: true, viewPosition: 0.3 });
        } catch {
          listRef.current?.scrollToOffset({ offset: targetIndex * 180, animated: true });
        }
      }, 350);

      setTimeout(() => {
        setHighlightHabitId(null);
      }, 3000);
    }
  }, [route.params?.targetHabitId, habits]);

  // AI Habit Generation
  const handleOpenAiModal = useCallback(() => {
    setAiPrompt('');
    setAiSuggestions([]);
    setAiModalVisible(true);
  }, []);

  const handleGenerateAiHabits = useCallback(async (customPrompt) => {
    const query = customPrompt || aiPrompt;
    if (!query || !query.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn chủ đề nhanh hoặc nhập nhu cầu sinh hoạt của bạn.');
      return;
    }
    setIsGeneratingAi(true);
    try {
      const result = await generateHabitsWithAi(query.trim());
      if (!result || result.length === 0) {
        Alert.alert('Thông báo', 'Gemini AI không tìm thấy gợi ý phù hợp. Vui lòng thử lại với mô tả chi tiết hơn.');
      } else {
        setAiSuggestions(result);
      }
    } catch (err) {
      Alert.alert('Lỗi AI', err.message || 'Không thể tạo việc vặt từ AI vào lúc này.');
    } finally {
      setIsGeneratingAi(false);
    }
  }, [aiPrompt]);

  const handleApplyAiHabits = useCallback(async () => {
    if (!aiSuggestions || aiSuggestions.length === 0) return;
    const newItems = aiSuggestions.map((item) => {
      const newHabit = {
        id: `habit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: item.title,
        type: item.type || HABIT_TYPES.INTERVAL,
        intervalDays: item.intervalDays || 30,
        dayOfMonth: item.dayOfMonth || 1,
        targetCount: item.targetCount || 1,
        unit: item.unit || 'lần',
        category: item.category || 'Sinh hoạt',
        note: item.note || '',
        icon: item.icon || 'repeat',
        color: item.color || '#3B82F6',
        lastCompletedDate: new Date().toISOString(),
        currentCount: 0,
        lastDailyDate: getTodayDateString(),
        reminderEnabled: !!item.reminderEnabled,
        reminderTime: item.reminderTime || '08:00',
        notificationId: null,
        history: [],
      };
      return newHabit;
    });

    for (const h of newItems) {
      if (h.reminderEnabled) {
        const notifId = await scheduleHabitReminder(h);
        h.notificationId = notifId;
      }
    }

    const merged = [...newItems, ...habits];
    updateHabitsList(merged);
    setAiModalVisible(false);
    setAiSuggestions([]);
    Alert.alert('Thành công', `Đã thêm ${newItems.length} việc vặt thông minh vào danh sách theo dõi của bạn! 🎉`);
  }, [aiSuggestions, habits, updateHabitsList]);

  // Hoàn thành việc / Reset chu kỳ
  const handleCompleteHabit = (id) => {
    const updated = recordHabitCompletion(habits, id);
    updateHabitsList(updated);
    const target = updated.find((h) => h.id === id);
    if (!target) return;

    if (target.reminderEnabled) {
      scheduleHabitReminder(target).catch(() => {});
    }

    if (Platform.OS !== 'web') {
      Alert.alert('Đã hoàn thành! 🎉', `Đã reset chu kỳ cho "${target.title}".`, [
        {
          text: 'Hoàn tác',
          style: 'destructive',
          onPress: () => {
            const restored = undoHabitCompletion(updated, id);
            updateHabitsList(restored);
            const restoredTarget = restored.find((h) => h.id === id);
            if (restoredTarget?.reminderEnabled) {
              scheduleHabitReminder(restoredTarget).catch(() => {});
            }
          },
        },
        { text: 'OK' },
      ]);
    }
  };

  const handleStepDaily = (id, delta) => {
    const updated = habits.map((h) => {
      if (h.id === id) {
        const today = getTodayDateString();
        const baseCount = h.lastDailyDate === today ? h.currentCount || 0 : 0;
        const nextCount = Math.max(0, baseCount + delta);
        return {
          ...h,
          currentCount: nextCount,
          lastDailyDate: today,
          lastCompletedDate: nextCount > 0 ? new Date().toISOString() : h.lastCompletedDate,
        };
      }
      return h;
    });
    updateHabitsList(updated);
  };

  const handleDeleteHabit = (id, title) => {
    Alert.alert(
      t('microHabit.deleteHabit') || 'Xóa việc vặt',
      `${t('microHabit.deleteConfirm') || 'Bạn có chắc muốn xóa việc này không?'}\n"${title}"`,
      [
        { text: t('common.cancel') || 'Hủy', style: 'cancel' },
        {
          text: t('common.confirm') || 'Xóa',
          style: 'destructive',
          onPress: async () => {
            const target = habits.find((h) => h.id === id);
            if (target?.notificationId) {
              await cancelHabitReminder(target.notificationId);
            }
            updateHabitsList(habits.filter((h) => h.id !== id));
          },
        },
      ]
    );
  };

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
    setFormErrors({});
    setModalVisible(true);
  };

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
    setFormErrors({});
    setModalVisible(true);
  };

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
      if (item.notificationId) {
        await cancelHabitReminder(item.notificationId);
      }
    }

    const updated = habits.map((h) =>
      h.id === item.id
        ? { ...h, reminderEnabled: newEnabled, notificationId: newNotifId }
        : h
    );
    updateHabitsList(updated);
  };

  const handleSimulateNotificationTap = useCallback((taskId) => {
    setDebugNotifModalVisible(false);
    requestOpenTask(taskId);
  }, []);

  const handleSaveForm = async () => {
    const errors = {};
    const trimmedTitle = formTitle.trim();
    const titleError = validateHabitTitle(trimmedTitle);
    if (titleError) errors.title = titleError;

    let selectedCategory = formCategory;
    if (formCategory === 'Khác') {
      const customError = validateCategoryName(formCustomCategory);
      if (customError) {
        errors.category = customError;
      } else {
        selectedCategory = formCustomCategory.trim();
        if (!customCategories.includes(selectedCategory)) {
          const nextCustomCats = [...customCategories, selectedCategory];
          setCustomCategories(nextCustomCats);
          await saveCustomCategories(nextCustomCats);
        }
      }
    }

    let parsedDayOfMonth = 1;
    if (formType === HABIT_TYPES.MONTHLY) {
      parsedDayOfMonth = parseInt(formDayOfMonth, 10);
      if (isNaN(parsedDayOfMonth) || parsedDayOfMonth < 1 || parsedDayOfMonth > 31) {
        errors.dayOfMonth = 'Ngày trong tháng phải từ 1 đến 31';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const validTime = formReminderEnabled && formReminderTime ? formReminderTime : null;

    if (editingId) {
      const oldHabit = habits.find((h) => h.id === editingId);
      if (oldHabit?.notificationId) {
        await cancelHabitReminder(oldHabit.notificationId);
      }

      const habitDraft = {
        ...oldHabit,
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
      };

      const newNotifId = await scheduleHabitReminder(habitDraft);
      habitDraft.notificationId = newNotifId;

      const updated = habits.map((h) => (h.id === editingId ? habitDraft : h));
      updateHabitsList(updated);
    } else {
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
    setFormErrors({});
  };

  const isFormValid = useMemo(() => {
    return formTitle.trim().length > 0;
  }, [formTitle]);

  const habitsWithStatus = useMemo(() => {
    return habits.map((h) => ({
      ...h,
      status: calculateHabitStatus(h),
    }));
  }, [habits]);

  const filteredHabits = useMemo(() => {
    return filterHabits(habitsWithStatus, {
      activeFilter,
      activeStatusFilter,
      debouncedSearch: normalizeHabitSearch(debouncedSearch),
    });
  }, [habitsWithStatus, activeFilter, activeStatusFilter, debouncedSearch]);

  const stats = useMemo(() => {
    return getHabitStats(habitsWithStatus);
  }, [habitsWithStatus]);

  const hasActiveFilters = activeFilter !== 'all' || activeStatusFilter !== null || debouncedSearch.trim().length > 0;
  const clearFilters = () => {
    setActiveFilter('all');
    setActiveStatusFilter(null);
    setSearchInput('');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title={t('microHabit.title') || 'Chu kỳ việc vặt'}
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <FlatList
        ref={listRef}
        data={filteredHabits}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HabitCard
            item={item}
            highlightHabitId={highlightHabitId}
            colors={colors}
            onOpenEditModal={handleOpenEditModal}
            onDeleteHabit={handleDeleteHabit}
            onQuickToggleReminder={handleQuickToggleReminder}
            onOpenHistory={(habit) => {
              setSelectedHabitForHistory(habit);
              setHistoryModalVisible(true);
            }}
            onCompleteHabit={handleCompleteHabit}
            onStepDaily={handleStepDaily}
            t={t}
          />
        )}
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
                    <Text style={styles.aiSuggestTopBtnText}>{t('microHabit.aiSuggest') || 'AI Gợi ý'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleOpenAddModal}
                    style={[styles.addTopBtn, { backgroundColor: '#10B981' }]}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.addTopBtnText}>{t('microHabit.addHabit') || 'Thêm việc'}</Text>
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
                  <Text style={[styles.statLabel, { color: colors.sub }]} numberOfLines={1} adjustsFontSizeToFit>{t('microHabit.urgent') || 'Quá hạn'}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveStatusFilter((current) => current === 'warning' ? null : 'warning')}
                  style={[styles.statBox, { backgroundColor: activeStatusFilter === 'warning' ? 'rgba(245, 158, 11, 0.24)' : 'rgba(245, 158, 11, 0.1)', borderColor: activeStatusFilter === 'warning' ? '#F59E0B' : 'transparent' }]}
                >
                  <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{stats.warning}</Text>
                  <Text style={[styles.statLabel, { color: colors.sub }]} numberOfLines={1} adjustsFontSizeToFit>{t('microHabit.dueSoon') || 'Sắp đến hạn'}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveStatusFilter((current) => current === 'safe' ? null : 'safe')}
                  style={[styles.statBox, { backgroundColor: activeStatusFilter === 'safe' ? 'rgba(16, 185, 129, 0.24)' : 'rgba(16, 185, 129, 0.1)', borderColor: activeStatusFilter === 'safe' ? '#10B981' : 'transparent' }]}
                >
                  <Text style={[styles.statNumber, { color: '#10B981' }]}>{stats.safe}</Text>
                  <Text style={[styles.statLabel, { color: colors.sub }]} numberOfLines={1} adjustsFontSizeToFit>{t('microHabit.safe') || 'Chưa đến hạn'}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveStatusFilter((current) => current === 'completed' ? null : 'completed')}
                  style={[styles.statBox, { backgroundColor: activeStatusFilter === 'completed' ? 'rgba(99, 102, 241, 0.24)' : colors.cardElevated, borderColor: activeStatusFilter === 'completed' ? '#818CF8' : 'transparent' }]}
                >
                  <Text style={[styles.statNumber, { color: '#A5B4FC' }]}>{stats.completed}</Text>
                  <Text style={[styles.statLabel, { color: colors.sub }]} numberOfLines={1} adjustsFontSizeToFit>{t('microHabit.todayDone') || 'Đã xong'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="search-outline" size={19} color={colors.sub} />
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder={t('microHabit.searchPlaceholder') || 'Tìm kiếm việc vặt...'}
                placeholderTextColor={colors.sub}
                style={[styles.searchInput, { color: colors.text }]}
                returnKeyType="search"
                accessibilityLabel="Tìm tên việc hoặc danh mục"
              />
              {searchInput ? <Pressable onPress={() => setSearchInput('')} hitSlop={8}><Ionicons name="close-circle" size={19} color={colors.sub} /></Pressable> : null}
            </View>

            {/* Bộ lọc Tab */}
            <View style={styles.filterRow}>
              {filterTabs.map((tab) => {
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
                  {[activeStatusFilter === 'overdue' ? 'Quá hạn' : activeStatusFilter === 'warning' ? 'Sắp đến hạn' : activeStatusFilter === 'safe' ? 'Chưa đến hạn' : null, activeFilter !== 'all' ? filterTabs.find((tab) => tab.id === activeFilter)?.label : null, debouncedSearch ? `“${debouncedSearch}”` : null, `${filteredHabits.length} việc`].filter(Boolean).join(' · ')}
                </Text>
                <Pressable onPress={clearFilters} hitSlop={8}><Text style={{ color: colors.primary, fontWeight: '800' }}>{t('microHabit.clearFilter') || 'Xóa lọc'}</Text></Pressable>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.sub} />
            <Text style={[styles.emptyText, { color: colors.sub }]}>
              {t('microHabit.noHabits') || 'Không có việc nào phù hợp'}
            </Text>
            {hasActiveFilters ? (
              <Pressable onPress={clearFilters} style={[styles.emptyClearButton, { borderColor: colors.primary }]}>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>{t('microHabit.clearFilter') || 'Xóa lọc'}</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />

      {/* Modal Thêm / Chỉnh sửa việc vặt */}
      <HabitFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        editingId={editingId}
        formType={formType}
        setFormType={setFormType}
        formTitle={formTitle}
        setFormTitle={setFormTitle}
        formErrors={formErrors}
        setFormErrors={setFormErrors}
        formIntervalDays={formIntervalDays}
        setFormIntervalDays={setFormIntervalDays}
        formDayOfMonth={formDayOfMonth}
        setFormDayOfMonth={setFormDayOfMonth}
        formTargetCount={formTargetCount}
        setFormTargetCount={setFormTargetCount}
        formUnit={formUnit}
        setFormUnit={setFormUnit}
        formReminderEnabled={formReminderEnabled}
        setFormReminderEnabled={setFormReminderEnabled}
        formReminderTime={formReminderTime}
        showTimePicker={showTimePicker}
        setShowTimePicker={setShowTimePicker}
        pickerDate={pickerDate}
        handleTimePickerChange={handleTimePickerChange}
        handleTestNotification={handleTestNotification}
        formCategory={formCategory}
        setFormCategory={setFormCategory}
        customCategories={customCategories}
        setCustomCategories={setCustomCategories}
        saveCustomCategories={saveCustomCategories}
        formCustomCategory={formCustomCategory}
        setFormCustomCategory={setFormCustomCategory}
        formNote={formNote}
        setFormNote={setFormNote}
        formColor={formColor}
        setFormColor={setFormColor}
        handleSaveForm={handleSaveForm}
        isFormValid={isFormValid}
        colors={colors}
        t={t}
        intervalPresets={INTERVAL_PRESETS}
        dailyPresets={DAILY_PRESETS}
        dailyUnits={DAILY_UNITS}
        categories={CATEGORIES}
        daysOfMonth={DAYS_OF_MONTH}
        presetColors={PRESET_COLORS}
      />

      {/* Modal Xem lịch sử lần hoàn thành */}
      <HabitHistoryModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        habit={selectedHabitForHistory}
        colors={colors}
        t={t}
      />

      {/* Modal Gemini AI Gợi ý việc vặt */}
      <HabitAiModal
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        isGeneratingAi={isGeneratingAi}
        aiSuggestions={aiSuggestions}
        onGenerateAiHabits={handleGenerateAiHabits}
        onApplyAiHabits={handleApplyAiHabits}
        colors={colors}
        t={t}
      />

      {/* Modal Debug Toàn Bộ Thông Báo OS Đã Lên Lịch */}
      <HabitDebugNotifModal
        visible={debugNotifModalVisible}
        onClose={() => setDebugNotifModalVisible(false)}
        scheduledNotifs={scheduledNotifs}
        onSimulateNotificationTap={handleSimulateNotificationTap}
        colors={colors}
        t={t}
      />
    </View>
  );
}
