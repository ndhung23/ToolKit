// src/features/micro-habit/microHabitService.js
// Logic tính toán chu kỳ, kiểm tra hạn chót, màu sắc cảnh báo, thông báo hẹn giờ và lưu trữ dữ liệu việc vặt

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export const HABIT_REMINDER_CHANNEL = 'habit-reminders';

export async function ensureHabitReminderChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(HABIT_REMINDER_CHANNEL, {
    name: 'Nhắc nhở việc vặt',
    // Android notification importance MAX. Numeric value avoids a stale SDK type export.
    importance: 5,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10B981',
  });
}

export async function requestAndroidExactAlarmPermission() {
  if (Platform.OS !== 'android' || !Notifications.getExactAlarmPermissionsAsync) return true;
  let permission = await Notifications.getExactAlarmPermissionsAsync();
  if (permission.status !== 'granted' && Notifications.requestExactAlarmPermissionsAsync) {
    permission = await Notifications.requestExactAlarmPermissionsAsync();
  }
  return permission.status === 'granted';
}

// Cấu hình hiển thị thông báo an toàn trong Expo Go
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    ensureHabitReminderChannel().catch(() => {});
  }
} catch {
  // Safe fallback
}

export const STORAGE_KEY_HABITS = '@toolkit_micro_habits_v1';
export const STORAGE_KEY_CUSTOM_CATEGORIES = '@toolkit_micro_habit_categories_v1';

export const HABIT_TYPES = {
  INTERVAL: 'interval', // Đếm ngược theo số ngày (mỗi X ngày)
  MONTHLY: 'monthly',   // Cố định ngày X hàng tháng
  DAILY: 'daily',       // Lặp lại số lần trong ngày
};
export const DEFAULT_CATEGORIES = ['Sinh hoạt', 'Nhà cửa', 'Sức khỏe', 'Xe cộ', 'Chi phí'];

export function normalizeCategoryName(value = '') {
  return String(value).trim().replace(/\s+/g, ' ');
}

export function validateCategoryName(value, existing = DEFAULT_CATEGORIES) {
  const name = normalizeCategoryName(value);
  if (!name) return 'Vui lòng nhập tên danh mục.';
  if (name.length > 20) return 'Tên danh mục tối đa 20 ký tự.';
  if (existing.some((item) => normalizeHabitSearch(item) === normalizeHabitSearch(name))) return 'Tên danh mục đã có.';
  return null;
}

export function validateHabitTitle(value) {
  const title = String(value || '').trim();
  if (!title) return 'Vui lòng nhập tên công việc.';
  if (title.length > 60) return 'Tên không được vượt quá 60 ký tự.';
  return null;
}

export async function loadCustomCategories() {
  try {
    const saved = JSON.parse(await AsyncStorage.getItem(STORAGE_KEY_CUSTOM_CATEGORIES) || '[]');
    return Array.isArray(saved) ? saved.slice(0, 10) : [];
  } catch { return []; }
}

export async function saveCustomCategories(categories = []) {
  await AsyncStorage.setItem(STORAGE_KEY_CUSTOM_CATEGORIES, JSON.stringify(categories.slice(0, 10)));
}

export const HABIT_ATTRIBUTE_COLORS = {
  cycle: { background: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.55)', text: '#60A5FA' },
  reminder: { background: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.55)', text: '#22D3EE' },
  count: { background: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.55)', text: '#A5B4FC' },
};

export function formatTaskNameForNotification(name, max = 60) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  const clipped = clean.slice(0, max - 1);
  const boundary = clipped.lastIndexOf(' ');
  return `${(boundary > Math.floor(max / 2) ? clipped.slice(0, boundary) : clipped).trim()}…`;
}

export function createHabitClone(habit, startDate = new Date()) {
  const start = new Date(startDate).toISOString();
  return {
    ...habit,
    id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    seriesId: habit.seriesId || habit.id,
    lastCompletedDate: habit.type === HABIT_TYPES.DAILY ? habit.lastCompletedDate : start,
    currentCount: habit.type === HABIT_TYPES.DAILY ? 0 : habit.currentCount,
    lastDailyDate: habit.type === HABIT_TYPES.DAILY ? getTodayDateString(startDate) : habit.lastDailyDate,
    notificationId: null,
    history: [],
  };
}

export function getSeriesCompletionCount(habit, allHabits = []) {
  const seriesId = habit.seriesId || habit.id;
  return allHabits.filter((item) => (item.seriesId || item.id) === seriesId)
    .reduce((total, item) => total + (Array.isArray(item.history) ? item.history.length : 0), 0);
}

export function getHabitStatusGroup(status) {
  if (status?.urgency === 'completed') return 'completed';
  if (status?.urgency === 'overdue') return 'overdue';
  if (status?.urgency === 'warning') return 'warning';
  return 'safe';
}

export function normalizeHabitSearch(value = '') {
  return String(value)
    .trim()
    .toLocaleLowerCase('vi-VN')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getHabitStats(habitsWithStatus = []) {
  const stats = { total: habitsWithStatus.length, overdue: 0, warning: 0, safe: 0, completed: 0 };
  habitsWithStatus.forEach((habit) => { stats[getHabitStatusGroup(habit.status)] += 1; });
  return stats;
}

export function filterHabits(habitsWithStatus = [], { typeFilter = 'all', statusFilter = null, search = '' } = {}) {
  const query = normalizeHabitSearch(search);
  return habitsWithStatus.filter((habit) => {
    const typeMatches = typeFilter === 'all'
      || (typeFilter === 'urgent' && ['overdue', 'warning'].includes(getHabitStatusGroup(habit.status)))
      || habit.type === typeFilter;
    const statusMatches = !statusFilter || getHabitStatusGroup(habit.status) === statusFilter;
    const searchMatches = !query || normalizeHabitSearch(`${habit.title || ''} ${habit.category || ''}`).includes(query);
    return typeMatches && statusMatches && searchMatches;
  }).sort((a, b) => ['overdue', 'warning', 'safe', 'completed'].indexOf(getHabitStatusGroup(a.status)) - ['overdue', 'warning', 'safe', 'completed'].indexOf(getHabitStatusGroup(b.status)));
}

// Chuẩn hóa ngày về 00:00:00 để so sánh số ngày chính xác
export function getMidnight(dateInput = new Date()) {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Lấy chuỗi YYYY-MM-DD theo giờ địa phương
export function getTodayDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyEventsForDate(item, now = new Date()) {
  const day = getTodayDateString(now);
  const events = Array.isArray(item.dailyCompletionEvents) ? item.dailyCompletionEvents : [];
  return events.filter((event) => event.date === day && event.kind === 'daily-completion');
}

export function getDailyCompletionCount(item, now = new Date()) {
  const events = getDailyEventsForDate(item, now);
  // Legacy records did not retain timestamps; preserve their displayed count until first new event migrates it.
  if (!events.length && !Array.isArray(item.dailyCompletionEvents)) {
    return item.lastDailyDate === getTodayDateString(now) ? Math.max(0, item.currentCount || 0) : 0;
  }
  return events.length;
}

export function recordCompletion(item, now = new Date()) {
  const timestamp = new Date(now).toISOString();
  const historyItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp, note: item.type === HABIT_TYPES.DAILY ? 'Ghi nhận 1 lần' : 'Hoàn thành chu kỳ' };
  if (item.type !== HABIT_TYPES.DAILY) {
    return { ...item, lastCompletedDate: timestamp, completedCycleAt: item.type === HABIT_TYPES.INTERVAL ? timestamp : item.completedCycleAt, history: [historyItem, ...(item.history || [])].slice(0, 100) };
  }
  const day = getTodayDateString(now);
  const previousEvents = Array.isArray(item.dailyCompletionEvents) ? item.dailyCompletionEvents : [];
  const legacyCount = !Array.isArray(item.dailyCompletionEvents) && item.lastDailyDate === day ? Math.max(0, item.currentCount || 0) : 0;
  const migrated = legacyCount ? Array.from({ length: legacyCount }, (_, index) => ({ id: `legacy-${item.id}-${day}-${index}`, date: day, timestamp, kind: 'daily-completion' })) : [];
  const event = { id: historyItem.id, date: day, timestamp, kind: 'daily-completion' };
  const events = [...previousEvents, ...migrated, event].slice(-500);
  const count = getDailyEventsForDate({ dailyCompletionEvents: events }, now).length;
  return { ...item, dailyCompletionEvents: events, currentCount: count, lastDailyDate: day, history: [historyItem, ...(item.history || [])].slice(0, 100) };
}

export function undoCompletion(item, now = new Date()) {
  if (item.type !== HABIT_TYPES.DAILY) return item;
  const day = getTodayDateString(now);
  const events = Array.isArray(item.dailyCompletionEvents) ? item.dailyCompletionEvents : [];
  const lastIndex = events.map((event, index) => ({ event, index })).filter(({ event }) => event.date === day && event.kind === 'daily-completion').at(-1)?.index;
  if (lastIndex === undefined) {
    const current = getDailyCompletionCount(item, now);
    return { ...item, currentCount: Math.max(0, current - 1), lastDailyDate: day };
  }
  const nextEvents = events.filter((_, index) => index !== lastIndex);
  const count = getDailyEventsForDate({ dailyCompletionEvents: nextEvents }, now).length;
  return { ...item, dailyCompletionEvents: nextEvents, currentCount: count, lastDailyDate: day, history: (item.history || []).filter((event) => event.id !== events[lastIndex].id) };
}

// Tính khoảng cách ngày: (targetDate - baseDate)
export function getDaysDiff(targetDate, baseDate = new Date()) {
  const t = getMidnight(targetDate).getTime();
  const b = getMidnight(baseDate).getTime();
  return Math.round((t - b) / (1000 * 60 * 60 * 24));
}

/**
 * Lấy ngày hợp lệ của một tháng (tự động co về ngày cuối tháng nếu tháng ngắn hơn targetDay)
 * Ví dụ: ngày 31 tháng 2 -> 28 hoặc 29; ngày 31 tháng 11 -> 30
 */
export function getValidMonthlyDate(year, monthIndex, targetDay) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const validDay = Math.min(Math.max(1, targetDay), daysInMonth);
  return new Date(year, monthIndex, validDay, 0, 0, 0, 0);
}

/**
 * Lấy danh sách toàn bộ thông báo đã lên lịch trong hệ điều hành (dùng cho debug & quản lý)
 */
export async function getAllScheduledHabitReminders() {
  try {
    const list = await Notifications.getAllScheduledNotificationsAsync();
    return list.map((item) => {
      let triggerSummary = 'Không xác định';
      if (item.trigger) {
        if (item.trigger.type === 'calendar' || item.trigger.date) {
          triggerSummary = `Ngày ${new Date(item.trigger.date || item.trigger.value).toLocaleString('vi-VN')}`;
        } else if (item.trigger.hour !== undefined) {
          const h = String(item.trigger.hour).padStart(2, '0');
          const m = String(item.trigger.minute || 0).padStart(2, '0');
          triggerSummary = `Hàng ngày lúc ${h}:${m}`;
        } else if (item.trigger.seconds) {
          triggerSummary = `Sau ${item.trigger.seconds} giây`;
        }
      }
      return {
        id: item.identifier,
        title: item.content?.title || '(Không có tiêu đề)',
        body: item.content?.body || '',
        habitId: item.content?.data?.habitId || null,
        triggerSummary,
      };
    });
  } catch (err) {
    console.warn('Lỗi lấy danh sách thông báo OS:', err);
    return [];
  }
}

/**
 * Lên lịch hoặc hủy thông báo hẹn giờ nhắc nhở cho từng việc vặt
 * @param {object} habit 
 * @returns {Promise<string|null>} notificationId mới hoặc null
 */
export async function scheduleHabitReminder(habit) {
  if (!habit) return null;

  // Hủy thông báo cũ nếu có
  if (habit.notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(habit.notificationId);
    } catch {
      // ignore
    }
  }

  // Nếu không bật nhắc nhở hoặc không có giờ
  if (!habit.reminderEnabled || !habit.reminderTime) {
    return null;
  }

  try {
    await ensureHabitReminderChannel();
    const exactAlarmGranted = await requestAndroidExactAlarmPermission();
    if (!exactAlarmGranted) console.warn('Android exact-alarm permission denied; reminder uses best-effort delivery.');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    const parts = habit.reminderTime.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1] || '0', 10);

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }

    // 1. Cho việc hàng ngày (DAILY): Lặp lại hàng ngày vào đúng khung giờ
    if (habit.type === HABIT_TYPES.DAILY) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Nhắc việc',
          body: `${formatTaskNameForNotification(habit.title)}\n${habit.note || 'Đã đến giờ hoàn thành mục tiêu.'}`,
          sound: true,
          data: { habitId: habit.id, taskId: habit.id },
          ...(Platform.OS === 'android' ? { channelId: HABIT_REMINDER_CHANNEL } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          repeats: true,
        },
      });
      return id;
    }

    // 2. Cho việc theo chu kỳ ngày (INTERVAL) hoặc theo tháng (MONTHLY):
    // Phải lên lịch vào đúng NGÀY ĐẾN HẠN tiếp theo lúc hour:minute (không được rung chuông mỗi ngày!)
    const status = calculateHabitStatus(habit);
    const targetDueDate = status.dueDate || new Date();
    const triggerDate = new Date(
      targetDueDate.getFullYear(),
      targetDueDate.getMonth(),
      targetDueDate.getDate(),
      hour,
      minute,
      0,
      0
    );

    // iOS chỉ nhận trigger tương lai; việc quá hạn sẽ được thể hiện rõ trên thẻ thay vì tạo chuông giả.
    const now = new Date();
    if (triggerDate.getTime() <= now.getTime()) {
      return null;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Nhắc việc',
        body: `${formatTaskNameForNotification(habit.title)}\n${habit.note || 'Hôm nay là ngày đến hạn chu kỳ.'}`,
        sound: true,
        data: { habitId: habit.id, taskId: habit.id },
        ...(Platform.OS === 'android' ? { channelId: HABIT_REMINDER_CHANNEL } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    return id;
  } catch (err) {
    console.warn('Lỗi lên lịch thông báo việc vặt:', err);
    return null;
  }
}

/** Rebuild native schedules on app open; iOS accepts at most 64 pending notifications. */
export async function reconcileHabitReminders(habits = []) {
  const candidates = habits
    .filter((habit) => habit?.reminderEnabled && habit?.reminderTime)
    .map((habit) => ({ habit, dueDate: calculateHabitStatus(habit).dueDate || new Date(8640000000000000) }))
    .sort((a, b) => a.dueDate - b.dueDate)
    .slice(0, 64);

  const permittedIds = new Set(candidates.map(({ habit }) => habit.id));
  const updated = [];
  for (const habit of habits) {
    if (!permittedIds.has(habit.id)) {
      if (habit.notificationId) await cancelHabitReminder(habit.notificationId);
      updated.push({ ...habit, notificationId: null });
      continue;
    }
    const notificationId = await scheduleHabitReminder(habit);
    updated.push({ ...habit, notificationId });
  }
  return updated;
}

/**
 * Hủy thông báo của việc vặt
 * @param {string} notificationId 
 */
export async function cancelHabitReminder(notificationId) {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // ignore
  }
}

/**
 * Bắn thông báo thử nghiệm ngay lập tức sau 2 giây để người dùng kiểm tra âm thanh & banner trên iOS / Android
 */
export async function testInstantNotification(title = '🔔 Thử nghiệm thông báo', body = 'Thông báo việc vặt hoạt động chuẩn xác!') {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      throw new Error('Chưa cấp quyền thông báo trên thiết bị. Vui lòng cho phép quyền thông báo trong Cài đặt máy.');
    }

    await ensureHabitReminderChannel();

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: HABIT_REMINDER_CHANNEL } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      },
    });
    return true;
  } catch (err) {
    throw err;
  }
}

/**
 * Tính toán trạng thái hạn chót & màu sắc cảnh báo cho từng mục
 * @param {object} item 
 * @returns {object} { daysRemaining, urgency: 'overdue'|'warning'|'safe', statusText, progress: 0..1, dueDate }
 */
export function calculateHabitStatus(item, now = new Date()) {
  const todayStr = getTodayDateString(now);

  // 1. CHU KỲ THEO SỐ NGÀY (INTERVAL)
  if (item.type === HABIT_TYPES.INTERVAL) {
    const intervalDays = Math.max(1, parseInt(item.intervalDays || 1, 10));
    const lastDate = item.lastCompletedDate ? new Date(item.lastCompletedDate) : new Date();
    
    // Ngày đến hạn tiếp theo = Ngày cuối + intervalDays
    const dueDate = new Date(lastDate);
    dueDate.setDate(dueDate.getDate() + intervalDays);

    const daysRemaining = getDaysDiff(dueDate, now);
    const daysPassed = getDaysDiff(now, lastDate);
    const progress = Math.max(0, Math.min(1, daysPassed / intervalDays));

    let urgency = item.completedCycleAt ? 'completed' : 'safe';
    let statusText = item.completedCycleAt ? `Đã xong chu kỳ này (còn ${daysRemaining} ngày)` : `Còn ${daysRemaining} ngày`;

    if (daysRemaining < 0) {
      urgency = 'overdue';
      statusText = `Quá hạn ${Math.abs(daysRemaining)} ngày!`;
    } else if (daysRemaining === 0) {
      urgency = 'overdue';
      statusText = 'Hôm nay đến hạn!';
    } else if (daysRemaining <= 3 || progress >= 0.8) {
      urgency = 'warning';
      statusText = `Sắp đến hạn (còn ${daysRemaining} ngày)`;
    }

    return {
      daysRemaining,
      daysPassed,
      urgency,
      statusText,
      cycleInfo: `Mỗi ${intervalDays} ngày`,
      progress,
      dueDate,
    };
  }

  // 2. CỐ ĐỊNH NGÀY HÀNG THÁNG (MONTHLY)
  if (item.type === HABIT_TYPES.MONTHLY) {
    const targetDay = Math.min(31, Math.max(1, parseInt(item.dayOfMonth || 1, 10)));
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // 1. Ngày hạn của THÁNG NÀY (đã tự co về ngày cuối tháng nếu tháng ngắn)
    const dueDateThisMonth = getValidMonthlyDate(currentYear, currentMonth, targetDay);

    // 2. Kiểm tra xem việc này đã được hoàn thành cho chu kỳ tháng này chưa
    let isCompletedForThisMonth = false;
    if (item.lastCompletedDate) {
      const lastDone = getMidnight(new Date(item.lastCompletedDate));
      // Nếu đã làm trong tháng này
      if (lastDone.getFullYear() === currentYear && lastDone.getMonth() === currentMonth) {
        // Đã hoàn thành trong chu kỳ tháng này
        isCompletedForThisMonth = true;
      } else if (lastDone >= dueDateThisMonth) {
        isCompletedForThisMonth = true;
      }
    }

    let dueDate;
    let urgency = 'safe';
    let statusText = '';
    const cycleInfo = `Ngày ${targetDay} hàng tháng`;

    if (isCompletedForThisMonth) {
      // Đã hoàn thành tháng này -> Kỳ tiếp theo là THÁNG SAU
      dueDate = getValidMonthlyDate(currentYear, currentMonth + 1, targetDay);
      const daysRemaining = getDaysDiff(dueDate, now);
      statusText = `Đã xong tháng này (còn ${daysRemaining} ngày)`;
      urgency = 'completed';
    } else {
      // Chưa hoàn thành tháng này
      dueDate = dueDateThisMonth;
      const daysRemaining = getDaysDiff(dueDate, now);

      if (daysRemaining < 0) {
        urgency = 'overdue';
        statusText = `Quá hạn ${Math.abs(daysRemaining)} ngày!`;
      } else if (daysRemaining === 0) {
        urgency = 'overdue'; // Hôm nay đến hạn cần làm
        statusText = 'Hôm nay đến hạn!';
      } else if (daysRemaining <= 3) {
        urgency = 'warning';
        statusText = `Sắp đến hạn (còn ${daysRemaining} ngày)`;
      } else {
        urgency = 'safe';
        statusText = `Còn ${daysRemaining} ngày`;
      }
    }

    const daysRemaining = getDaysDiff(dueDate, now);

    return {
      daysRemaining,
      urgency,
      statusText,
      cycleInfo,
      progress: isCompletedForThisMonth ? 1 : daysRemaining <= 0 ? 1 : Math.max(0, 1 - daysRemaining / 30),
      dueDate,
    };
  }

  // 3. ĐẾM LẦN TRONG NGÀY (DAILY COUNTER)
  if (item.type === HABIT_TYPES.DAILY) {
    const target = Math.max(1, parseInt(item.targetCount || 1, 10));
    // Tự động reset về 0 nếu đã qua 00:00 ngày mới
    const current = getDailyCompletionCount(item, now);
    const progress = Math.min(1, current / target);
    const isCompleted = current >= target;

    let urgency = 'safe';
    let statusText = `Đã xong ${current}/${target} ${item.unit || 'lần'}`;

    if (isCompleted) {
      urgency = 'completed';
      statusText = `Đã hoàn thành! (${current}/${target})`;
    } else if (current === 0) {
      urgency = 'warning';
      statusText = `Chưa làm (0/${target} ${item.unit || 'lần'})`;
    } else {
      urgency = 'warning';
      statusText = `Tiến độ: ${current}/${target} ${item.unit || 'lần'}`;
    }

    return {
      daysRemaining: 0,
      urgency,
      statusText,
      cycleInfo: `Mục tiêu ${target} ${item.unit || 'lần'}/ngày`,
      progress,
      isCompleted,
      currentCount: current,
      targetCount: target,
    };
  }

  return {
    daysRemaining: 0,
    urgency: 'safe',
    statusText: '',
    progress: 0,
  };
}

// Dữ liệu mẫu ban đầu chuẩn thực tế
export const DEFAULT_HABITS = [
  {
    id: 'habit-oil',
    title: 'Thay nhớt xe máy',
    type: HABIT_TYPES.INTERVAL,
    intervalDays: 45,
    lastCompletedDate: new Date(Date.now() - 36 * 24 * 60 * 60 * 1000).toISOString(), // Còn 9 ngày
    icon: 'construct',
    color: '#F59E0B',
    category: 'Xe cộ',
    note: 'Nhớt tổng hợp 10W40, kiểm tra cả nước mát',
    reminderEnabled: false,
    reminderTime: '08:00',
    notificationId: null,
    history: [
      { id: '1', timestamp: new Date(Date.now() - 36 * 24 * 60 * 60 * 1000).toISOString(), note: 'Thay nhớt Motul 7100' }
    ],
  },
  {
    id: 'habit-water-gas',
    title: 'Gọi bình nước lọc / Đổi bình ga',
    type: HABIT_TYPES.INTERVAL,
    intervalDays: 15,
    lastCompletedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // Còn 1 ngày (Sắp hết)
    icon: 'water',
    color: '#3B82F6',
    category: 'Gia đình',
    note: 'Đại lý Lavie / Gas Petrolimex gần nhà',
    reminderEnabled: true,
    reminderTime: '09:00',
    notificationId: null,
    history: [],
  },
  {
    id: 'habit-bedsheet',
    title: 'Giặt chăn ga gối đệm',
    type: HABIT_TYPES.INTERVAL,
    intervalDays: 14,
    lastCompletedDate: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(), // Quá hạn 3 ngày (Đỏ)
    icon: 'bed',
    color: '#8B5CF6',
    category: 'Nhà cửa',
    note: 'Ngâm xả Comfort và phơi nắng to',
    reminderEnabled: false,
    reminderTime: '08:00',
    notificationId: null,
    history: [],
  },
  {
    id: 'habit-rent',
    title: 'Đóng tiền trọ & Điện nước',
    type: HABIT_TYPES.MONTHLY,
    dayOfMonth: 5,
    lastCompletedDate: null,
    icon: 'home',
    color: '#EF4444',
    category: 'Chi phí',
    note: 'Chuyển khoản qua số tài khoản chủ nhà',
    reminderEnabled: true,
    reminderTime: '08:30',
    notificationId: null,
    history: [],
  },
  {
    id: 'habit-internet',
    title: 'Gia hạn gói cước 4G / Internet',
    type: HABIT_TYPES.MONTHLY,
    dayOfMonth: 20,
    lastCompletedDate: null,
    icon: 'wifi',
    color: '#06B6D4',
    category: 'Dịch vụ',
    note: 'Gói 120k/tháng Viettel',
    reminderEnabled: false,
    reminderTime: '09:00',
    notificationId: null,
    history: [],
  },
  {
    id: 'habit-medicine',
    title: 'Uống thuốc / Vitamin',
    type: HABIT_TYPES.DAILY,
    targetCount: 2,
    currentCount: 1,
    unit: 'lần',
    lastDailyDate: getTodayDateString(),
    icon: 'medkit',
    color: '#EC4899',
    category: 'Sức khỏe',
    note: 'Uống sau bữa ăn sáng và tối',
    reminderEnabled: true,
    reminderTime: '08:00',
    notificationId: null,
    history: [],
  },
  {
    id: 'habit-drink-water',
    title: 'Uống đủ nước lọc mỗi ngày',
    type: HABIT_TYPES.DAILY,
    targetCount: 8,
    currentCount: 4,
    unit: 'cốc',
    lastDailyDate: getTodayDateString(),
    icon: 'pint',
    color: '#10B981',
    category: 'Sức khỏe',
    note: 'Mỗi cốc khoảng 250ml (tổng 2L/ngày)',
    reminderEnabled: false,
    reminderTime: '10:00',
    notificationId: null,
    history: [],
  },
];

// Lưu danh sách việc vặt
export async function saveHabits(habits) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(habits));
    return true;
  } catch (err) {
    console.warn('Lỗi lưu danh sách việc vặt:', err);
    return false;
  }
}

// Tải danh sách việc vặt (tự động điền dữ liệu mẫu nếu chưa có)
export async function loadHabits() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_HABITS);
    if (!raw) {
      await saveHabits(DEFAULT_HABITS);
      return DEFAULT_HABITS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const todayStr = getTodayDateString();
      // Tự động kiểm tra reset daily counters nếu sang ngày mới
      const validated = parsed.map((item) => {
        let updated = { ...item };
        if (item.type === HABIT_TYPES.DAILY && item.lastDailyDate !== todayStr) {
          updated.currentCount = 0;
          updated.lastDailyDate = todayStr;
        }
        if (updated.reminderEnabled === undefined) {
          updated.reminderEnabled = false;
        }
        if (!updated.reminderTime) {
          updated.reminderTime = '08:00';
        }
        return updated;
      });
      return validated;
    }
    return DEFAULT_HABITS;
  } catch {
    return DEFAULT_HABITS;
  }
}
