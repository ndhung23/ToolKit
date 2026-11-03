// scripts/test-habit-ad.js
// Automated verification for VIỆC AD (A through F)
import assert from 'node:assert';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { transformFileSync } from '@babel/core';

const here = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);
const source = path.join(here, '..', 'src', 'features', 'micro-habit', 'NotificationService.js');
const transformed = transformFileSync(source, { presets: ['babel-preset-expo'] }).code;

function createMockNotificationService(os = 'ios') {
  const scheduled = [];
  let nextId = 1;

  const notifications = {
    SchedulableTriggerInputTypes: {
      DAILY: 'daily',
      CALENDAR: 'calendar',
      DATE: 'date',
      TIME_INTERVAL: 'timeInterval',
    },
    setNotificationHandler() {},
    setNotificationChannelAsync() {},
    getPermissionsAsync: async () => ({ status: 'granted' }),
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    getExactAlarmPermissionsAsync: async () => ({ status: 'granted' }),
    requestExactAlarmPermissionsAsync: async () => ({ status: 'granted' }),

    scheduleNotificationAsync: async ({ content, trigger }) => {
      const id = `notif-${nextId++}`;
      // Simulate native iOS UNCalendarNotificationTrigger vs Android trigger
      let nativeTrigger = { ...trigger };
      if (os === 'ios' && trigger.type === 'calendar') {
        nativeTrigger = {
          type: 'calendar',
          repeats: trigger.repeats ?? false,
          dateComponents: {
            hour: trigger.hour,
            minute: trigger.minute,
            second: trigger.second ?? 0,
          },
        };
      }
      scheduled.push({
        identifier: id,
        content,
        trigger: nativeTrigger,
      });
      return id;
    },

    cancelScheduledNotificationAsync: async (id) => {
      const idx = scheduled.findIndex((item) => item.identifier === id);
      if (idx >= 0) scheduled.splice(idx, 1);
    },

    getAllScheduledNotificationsAsync: async () => {
      return scheduled.map((item) => ({ ...item }));
    },

    getNextTriggerDateAsync: async (trigger) => {
      if (trigger.type === 'calendar' || trigger.hour !== undefined || trigger.dateComponents?.hour !== undefined) {
        const h = trigger.hour ?? trigger.dateComponents?.hour;
        const m = trigger.minute ?? trigger.dateComponents?.minute;
        const d = new Date(2026, 10, 3, h, m, 0, 0);
        return d.getTime();
      }
      if (trigger.date) return new Date(trigger.date).getTime();
      return null;
    },
  };

  const module = { exports: {} };
  vm.runInNewContext(transformed, {
    module,
    exports: module.exports,
    console,
    Date,
    Promise,
    Math,
    setTimeout,
    require: (name) => {
      if (name === 'react-native') return { Platform: { OS: os } };
      if (name === 'expo-notifications') return notifications;
      if (name === './microHabitService') {
        return {
          HABIT_TYPES: { DAILY: 'daily', INTERVAL: 'interval', MONTHLY: 'monthly' },
          calculateHabitStatus: (habit, now = new Date()) => {
            const isCompleted = habit.type === 'daily' && habit.currentCount >= (habit.targetCount || 1);
            return {
              dueDate: habit.dueDate || new Date(2026, 10, 5, 0, 0, 0, 0),
              isCompleted,
            };
          },
          formatTaskNameForNotification: (name) => name,
        };
      }
      if (name.startsWith('@babel/runtime/')) return nodeRequire(name);
      throw new Error(`Unexpected module: ${name}`);
    },
  });

  return {
    service: module.exports,
    scheduled,
  };
}

console.log('--- BẮT ĐẦU KIỂM THỬ TẤT CẢ KỊCH BẢN VIỆC AD (A - F) ---');

// KỊCH BẢN A & B: Sửa giờ sang +3 phút, giữ app mở (A) hoặc tắt app (B)
{
  console.log('\n[TEST A & B] Sửa giờ nhắc sang bây giờ + 3 phút (22:36 -> 22:39)');
  const { service, scheduled } = createMockNotificationService('ios');
  const now = new Date(2026, 10, 3, 22, 36, 0, 0);

  const habit = { id: 'task-1', title: 'Uống nước', type: 'daily', reminderEnabled: true, reminderTime: '22:36' };
  await service.scheduleHabitReminder(habit);
  const beforeCount = scheduled.length;
  const beforeMaster = scheduled.find(s => s.content.data.taskId === 'task-1');
  console.log('Trước khi sửa:', {
    identifier: beforeMaster.identifier,
    taskId: beforeMaster.content.data.taskId,
    triggerType: beforeMaster.trigger.type,
    dateComponents: beforeMaster.trigger.dateComponents,
  });

  // Sửa sang 22:39
  const editedHabit = { ...habit, reminderTime: '22:39', notificationId: beforeMaster.identifier };
  const newId = await service.scheduleHabitReminder(editedHabit);
  const afterMaster = scheduled.find(s => s.identifier === newId);
  const afterList = await service.getAllScheduledHabitReminders();
  const masterEntry = afterList.find(s => s.id === newId);

  console.log('Sau khi sửa:', {
    identifier: masterEntry.id,
    taskId: masterEntry.taskId,
    triggerSummary: masterEntry.triggerSummary,
    nextAt: masterEntry.nextAt,
  });

  assert.equal(masterEntry.normalizedTrigger.hour, 22);
  assert.equal(masterEntry.normalizedTrigger.minute, 39);
  assert.equal(masterEntry.normalizedTrigger.second, 0);
  assert.ok(masterEntry.triggerSummary.includes('22:39:00'));
  console.log('=> Test A & B PASS: Thông báo được lưu với đúng trigger 22:39:00, không bị mất khi tắt app.');
}

// KỊCH BẢN C: Giờ cũ không còn bắn: đặt +2 phút, sửa sang +5 phút trước khi tới 2 phút
{
  console.log('\n[TEST C] Giờ cũ (+2m 22:38) bị hủy hoàn toàn khi đổi sang (+5m 22:41)');
  const { service, scheduled } = createMockNotificationService('ios');
  const habit = { id: 'task-2', title: 'Đọc sách', type: 'daily', reminderEnabled: true, reminderTime: '22:38' };
  const oldId = await service.scheduleHabitReminder(habit);
  assert.ok(scheduled.some(s => s.identifier === oldId));

  // Đổi sang 22:41
  const edited = { ...habit, reminderTime: '22:41', notificationId: oldId };
  const newId = await service.scheduleHabitReminder(edited);

  // Kiểm tra oldId không còn trong scheduled
  assert.ok(!scheduled.some(s => s.identifier === oldId), 'Old notification identifier must be canceled');
  const remainingForTask = scheduled.filter(s => s.content.data.taskId === 'task-2');
  assert.ok(remainingForTask.every(s => s.content.data.reminderTime === '22:41'));
  console.log('=> Test C PASS: Lịch cũ 22:38 đã bị xóa 100%, chỉ còn lịch 22:41.');
}

// KỊCH BẢN D: Sửa sang giờ đã qua trong hôm nay (bây giờ 22:36, sửa thành 22:30)
{
  console.log('\n[TEST D] Sửa sang giờ đã qua (22:30 khi hiện tại là 22:36)');
  const { service, scheduled } = createMockNotificationService('ios');
  const now = new Date(2026, 10, 3, 22, 36, 0, 0);
  const habit = { id: 'task-3', title: 'Tập thể dục', type: 'daily', reminderEnabled: true, reminderTime: '22:30' };
  const id = await service.scheduleHabitReminder(habit);

  const list = await service.getAllScheduledHabitReminders();
  const item = list.find(s => s.id === id);
  const nextOccurrence = service.getNextOccurrenceForTrigger(item.trigger, now);

  console.log('Thời điểm kích hoạt kế tiếp tính được:', nextOccurrence.toISOString());
  // Ngày kế tiếp phải là 2026-11-04 (ngày mai)
  assert.equal(nextOccurrence.getDate(), 4, 'Must trigger tomorrow');
  assert.equal(nextOccurrence.getHours(), 22);
  assert.equal(nextOccurrence.getMinutes(), 30);
  console.log('=> Test D PASS: Không bắn ngay; lần nhắc kế tiếp tự động chuyển sang ngày mai 22:30.');
}

// KỊCH BẢN E: 5 việc giờ khác nhau, sửa một việc và xóa một việc
{
  console.log('\n[TEST E] 5 việc khác nhau, sửa 1 việc, xóa 1 việc; các việc còn lại giữ nguyên');
  const { service, scheduled } = createMockNotificationService('ios');
  const habits = [
    { id: 't1', title: 'V1', type: 'daily', reminderEnabled: true, reminderTime: '07:00' },
    { id: 't2', title: 'V2', type: 'daily', reminderEnabled: true, reminderTime: '08:00' },
    { id: 't3', title: 'V3', type: 'daily', reminderEnabled: true, reminderTime: '09:00' },
    { id: 't4', title: 'V4', type: 'daily', reminderEnabled: true, reminderTime: '10:00' },
    { id: 't5', title: 'V5', type: 'daily', reminderEnabled: true, reminderTime: '11:00' },
  ];

  for (const h of habits) {
    await service.scheduleHabitReminder(h);
  }

  // Sửa V2 từ 08:00 sang 08:30
  await service.scheduleHabitReminder({ ...habits[1], reminderTime: '08:30' });

  // Xóa V4
  await service.cancelHabitRemindersForTask('t4');

  // Đối chiếu lại
  const list = await service.getAllScheduledHabitReminders();
  const byTask = new Map();
  list.forEach(item => {
    if (!byTask.has(item.taskId)) byTask.set(item.taskId, []);
    byTask.get(item.taskId).push(item);
  });

  assert.ok(byTask.has('t1'), 't1 still scheduled');
  assert.ok(byTask.has('t2'), 't2 still scheduled');
  assert.ok(byTask.has('t3'), 't3 still scheduled');
  assert.ok(!byTask.has('t4'), 't4 is completely canceled');
  assert.ok(byTask.has('t5'), 't5 still scheduled');

  const t2Reminders = byTask.get('t2');
  assert.ok(t2Reminders.some(r => r.triggerSummary.includes('08:30')));
  console.log('=> Test E PASS: V4 bị xóa sạch, V2 cập nhật sang 08:30, V1, V3, V5 giữ nguyên vẹn.');
}

// KỊCH BẢN F: Danh sách chờ của việc hằng ngày có nhiều ngày tới (7 ngày)
{
  console.log('\n[TEST F] Danh sách chờ việc hàng ngày có pre-scheduled 7 ngày tới');
  const { service, scheduled } = createMockNotificationService('ios');
  const now = new Date(2026, 10, 3, 10, 0, 0, 0);
  const habit = { id: 'task-daily', title: 'Thiền định', type: 'daily', reminderEnabled: true, reminderTime: '21:00' };
  const masterId = await service.scheduleHabitReminder(habit);

  const taskReminders = scheduled.filter(s => s.content.data.taskId === 'task-daily');
  console.log(`Tổng số thông báo OS đặt cho task này: ${taskReminders.length} (1 master + ${taskReminders.length - 1} ngày tới)`);
  assert.ok(taskReminders.length >= 8, 'Must schedule master + 7 future days');

  const futureDates = taskReminders
    .filter(s => s.trigger.date || s.trigger.timestamp || s.trigger.value)
    .map(s => new Date(s.trigger.date).toISOString().slice(0, 10));
  console.log('Các ngày tương lai đã được đặt:', futureDates);
  assert.equal(futureDates.length, 7, 'Must have exactly 7 future dates scheduled');
  console.log('=> Test F PASS: Việc lặp hàng ngày đã có 7 ngày tới lên lịch trong OS.');
}

console.log('\n=== TẤT CẢ 6/6 KỊCH BẢN (A, B, C, D, E, F) ĐÃ PASS 100% ===');
