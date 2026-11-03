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

function loadFor(os) {
  const module = { exports: {} };
  const notifications = {
    SchedulableTriggerInputTypes: { DAILY: 'daily', CALENDAR: 'calendar', DATE: 'date', TIME_INTERVAL: 'timeInterval' },
    setNotificationHandler() {}, setNotificationChannelAsync() {},
  };
  vm.runInNewContext(transformed, {
    module, exports: module.exports, console, Date, Promise, Math, setTimeout,
    require: (name) => {
      if (name === 'react-native') return { Platform: { OS: os } };
      if (name === 'expo-notifications') return notifications;
      if (name === './microHabitService') return {
        HABIT_TYPES: { DAILY: 'daily', INTERVAL: 'interval', MONTHLY: 'monthly' },
        calculateHabitStatus: (habit) => ({ dueDate: habit.dueDate || null, isCompleted: false }),
        formatTaskNameForNotification: (name) => name,
      };
      if (name.startsWith('@babel/runtime/')) return nodeRequire(name);
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return module.exports;
}

const now = new Date(2026, 10, 3, 22, 36, 17, 0);
const daily = { id: 'daily-1', type: 'daily', reminderTime: '22:39' };
const ios = loadFor('ios');
const android = loadFor('android');

const iosTrigger = ios.buildHabitReminderTrigger(daily, now);
assert.deepEqual(iosTrigger, { type: 'calendar', hour: 22, minute: 39, second: 0, timezone: 'Asia/Ho_Chi_Minh', repeats: true });
assert.equal(ios.getNextOccurrenceForTrigger(iosTrigger, now).toISOString(), new Date(2026, 10, 3, 22, 39, 0, 0).toISOString());
console.log('[PASS] iOS uses repeating calendar trigger; next +3 minute reminder is today 22:39:00.');

const androidTrigger = android.buildHabitReminderTrigger(daily, now);
assert.deepEqual(androidTrigger, { type: 'daily', hour: 22, minute: 39 });
console.log('[PASS] Android uses SDK 58 daily trigger.');

const past = ios.getNextOccurrenceForTrigger(ios.buildHabitReminderTrigger({ ...daily, reminderTime: '22:35' }, now), now);
assert.equal(past.toISOString(), new Date(2026, 10, 4, 22, 35, 0, 0).toISOString());
console.log('[PASS] A reminder time already passed moves to tomorrow; it is not delivered immediately.');

const due = new Date(2026, 10, 5, 0, 0, 0, 0);
const interval = ios.buildHabitReminderTrigger({ id: 'interval-1', type: 'interval', reminderTime: '08:00', dueDate: due }, now);
assert.equal(interval.type, 'date');
assert.equal(interval.date.toISOString(), new Date(2026, 10, 5, 8, 0, 0, 0).toISOString());
console.log('[PASS] One-off interval reminder is a future date trigger with seconds 0.');
console.log('Kết quả: 4/4 kiểm tra trigger thông báo đã pass.');
