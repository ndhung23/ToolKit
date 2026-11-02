// Single native-notification boundary. UI code must not call expo-notifications directly.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { HABIT_TYPES, calculateHabitStatus, formatTaskNameForNotification } from './microHabitService';

export const HABIT_REMINDER_CHANNEL = 'habit-reminders';
const MANAGED_BY = 'micro-habit';
const debugLog = [];
let queue = Promise.resolve();

function nowLog(action, detail = {}) {
  const entry = { at: new Date().toISOString(), action, ...detail };
  debugLog.unshift(entry);
  if (debugLog.length > 100) debugLog.pop();
  console.info('[HabitNotification]', entry);
}

function serial(work) {
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}

export function getNotificationDebugLog() { return [...debugLog]; }

export async function ensureHabitReminderChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(HABIT_REMINDER_CHANNEL, {
    name: 'Nhắc nhở việc vặt', importance: 5,
    vibrationPattern: [0, 250, 250, 250], lightColor: '#10B981',
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

export function getReminderKey(habit) {
  if (habit.type === HABIT_TYPES.DAILY) return `task:${habit.id}:daily`;
  const dueDate = calculateHabitStatus(habit).dueDate;
  const day = dueDate ? dueDate.toISOString().slice(0, 10) : 'none';
  return `task:${habit.id}:${day}`;
}

function getTrigger(habit) {
  const [hour, minute] = String(habit.reminderTime || '').split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  if (habit.type === HABIT_TYPES.DAILY) {
    return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, repeats: true };
  }
  const due = calculateHabitStatus(habit).dueDate;
  if (!due) return null;
  const date = new Date(due.getFullYear(), due.getMonth(), due.getDate(), hour, minute, 0, 0);
  return date > new Date() ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date } : null;
}

function triggerSignature(trigger) {
  if (!trigger) return 'none';
  if (trigger.date) return `date:${new Date(trigger.date).getTime()}`;
  return `daily:${trigger.hour}:${trigger.minute}`;
}

async function permissionGranted() {
  await ensureHabitReminderChannel();
  await requestAndroidExactAlarmPermission();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
  return permission.status === 'granted';
}

function contentFor(habit, key) {
  return {
    title: '🔔 Nhắc việc',
    body: `${formatTaskNameForNotification(habit.title)}\n${habit.note || 'Đã đến giờ hoàn thành công việc.'}`,
    sound: true,
    data: { taskId: habit.id, habitId: habit.id, notificationKey: key, managedBy: MANAGED_BY },
    ...(Platform.OS === 'android' ? { channelId: HABIT_REMINDER_CHANNEL } : {}),
  };
}

async function scheduleOne(habit) {
    if (!habit?.reminderEnabled || !habit.reminderTime) return null;
    const trigger = getTrigger(habit);
    if (!trigger) { nowLog('skip-past-or-invalid', { taskId: habit.id }); return null; }
    if (!await permissionGranted()) { nowLog('permission-denied', { taskId: habit.id }); return null; }
    const key = getReminderKey(habit);
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const matching = pending.find((item) => item.content?.data?.notificationKey === key && triggerSignature(item.trigger) === triggerSignature(trigger));
    if (matching) { nowLog('reuse', { taskId: habit.id, key, id: matching.identifier }); return matching.identifier; }
    const stale = pending.filter((item) => item.content?.data?.notificationKey === key);
    await Promise.all(stale.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
    const id = await Notifications.scheduleNotificationAsync({ content: contentFor(habit, key), trigger });
    nowLog('scheduled', { taskId: habit.id, key, id, trigger: triggerSignature(trigger) });
    return id;
}

export function scheduleHabitReminder(habit) {
  return serial(() => scheduleOne(habit));
}

export function cancelHabitReminder(notificationId, reason = 'explicit') {
  return serial(async () => {
    if (!notificationId) return;
    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
    nowLog('cancelled', { id: notificationId, reason });
  });
}

export function reconcileHabitReminders(habits = []) {
  return serial(async () => {
    const allowed = habits.filter((habit) => habit?.reminderEnabled && habit?.reminderTime)
      .map((habit) => ({ habit, trigger: getTrigger(habit), key: getReminderKey(habit) }))
      .filter((item) => item.trigger)
      .slice(0, 64);
    const desired = new Map(allowed.map((item) => [item.key, item]));
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of pending) {
      const key = item.content?.data?.notificationKey;
      if (item.content?.data?.managedBy === MANAGED_BY && (!desired.has(key) || triggerSignature(item.trigger) !== triggerSignature(desired.get(key).trigger))) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => {});
        nowLog('cancelled-stale', { id: item.identifier, key });
      }
    }
    const fresh = await Notifications.getAllScheduledNotificationsAsync();
    const ids = new Map(fresh.map((item) => [item.content?.data?.notificationKey, item.identifier]));
    const result = habits.map((habit) => ({ ...habit, notificationId: ids.get(getReminderKey(habit)) || null }));
    for (const { habit, key } of allowed) {
      const id = ids.get(key) || await scheduleOne(habit);
      const index = result.findIndex((item) => item.id === habit.id);
      if (index >= 0) result[index].notificationId = id;
    }
    nowLog('reconciled', { desired: allowed.length });
    return result;
  });
}

export function getAllScheduledHabitReminders() {
  return Notifications.getAllScheduledNotificationsAsync().then((items) => items
    .filter((item) => item.content?.data?.managedBy === MANAGED_BY)
    .map((item) => {
      const trigger = item.trigger || {};
      const triggerSummary = trigger.date ? new Date(trigger.date).toLocaleString('vi-VN') : trigger.hour !== undefined ? `Hàng ngày lúc ${String(trigger.hour).padStart(2, '0')}:${String(trigger.minute || 0).padStart(2, '0')}` : 'Không xác định';
      return { id: item.identifier, taskId: item.content?.data?.taskId, title: item.content?.title, body: item.content?.body, trigger, triggerSummary };
    }));
}

export function testInstantNotification(taskId, title = '🔔 Thử chuông', body = 'Thông báo việc vặt hoạt động.') {
  return serial(async () => {
    if (!taskId) throw new Error('Chọn một việc trước khi thử chuông.');
    if (!await permissionGranted()) throw new Error('Chưa được cấp quyền thông báo.');
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, data: { taskId, habitId: taskId, managedBy: MANAGED_BY, test: true }, ...(Platform.OS === 'android' ? { channelId: HABIT_REMINDER_CHANNEL } : {}) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
    });
    nowLog('test-scheduled', { taskId, id });
    return id;
  });
}

try {
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  ensureHabitReminderChannel().catch(() => {});
} catch { /* Expo Go fallback */ }
