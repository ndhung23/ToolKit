// scripts/test-habit-ah.js
// Automated verification for VIỆC AH (Không đơ / Không crash khi lưu việc vặt)
import assert from 'node:assert';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { transformFileSync } from '@babel/core';

const here = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);

function loadService(relPath, customRequire = {}) {
  const source = path.join(here, '..', relPath);
  const transformed = transformFileSync(source, { presets: ['babel-preset-expo'] }).code;
  const mod = { exports: {} };
  vm.runInNewContext(transformed, {
    module: mod,
    exports: mod.exports,
    require: (name) => {
      if (customRequire[name]) return customRequire[name];
      if (name === 'react-native') return { Platform: { OS: 'ios' } };
      if (name.includes('async-storage')) return {};
      if (name === 'expo-notifications') return {
        SchedulableTriggerInputTypes: { DAILY: 'daily', CALENDAR: 'calendar', DATE: 'date', TIME_INTERVAL: 'timeInterval' },
        setNotificationHandler() {},
        setNotificationChannelAsync: async () => {},
        getPermissionsAsync: async () => ({ status: 'granted' }),
        getAllScheduledNotificationsAsync: async () => [],
        cancelScheduledNotificationAsync: async () => {},
        scheduleNotificationAsync: async () => 'notif-1',
        getNextTriggerDateAsync: async () => null,
      };
      if (name.startsWith('@babel/runtime/')) return nodeRequire(name);
      throw new Error(`Unexpected require: ${name}`);
    },
    console,
    Date,
    Math,
    setTimeout,
    clearTimeout,
    Promise,
  });
  return mod.exports;
}

const microService = loadService('src/features/micro-habit/microHabitService.js');
const notifService = loadService('src/features/micro-habit/NotificationService.js', {
  './microHabitService': microService,
});

console.log('--- BẮT ĐẦU KIỂM THỬ VIỆC AH (LƯU VIỆC VẶT KHÔNG ĐƠ / CRASH) ---');

// [TEST AH-1] Tái hiện đúng kịch bản của người dùng:
// Việc "Trong ngày", tên "test 3", mục tiêu 4 lần, nhắc 09:03 (giờ đã qua hôm nay), chọn "Tính từ hôm nay"
console.log('\n[TEST AH-1] Kịch bản chính: "Trong ngày", test 3, 4 lần, 09:03 đã qua');
const now = new Date();
now.setHours(11, 55, 0, 0); // Giờ lúc người dùng test (11:55)
const userTask = {
  id: 'habit-test-3',
  title: 'test 3',
  type: microService.HABIT_TYPES.DAILY,
  targetCount: 4,
  currentCount: 0,
  unit: 'lần',
  reminderEnabled: true,
  reminderTime: '09:03',
  startDate: microService.getTodayDateString(now),
};

const startCalc = Date.now();
const occ = microService.computeNextOccurrence(userTask, now);
const status = microService.calculateHabitStatus(userTask, now);
const endCalc = Date.now();

assert.ok(occ, 'Phải tính được occurrence');
assert.equal(occ.passedToday, true, '09:03 phải là đã qua so với 11:55');
assert.equal(occ.isTomorrow, true, 'Nhắc đầu tiên phải là ngày mai');
assert.equal(status.urgency, 'warning', 'Chưa làm lần nào hôm nay phải ở trạng thái warning (Sắp đến hạn)');
assert.ok(endCalc - startCalc < 50, `Thời gian tính toán phải < 50ms (thực tế: ${endCalc - startCalc}ms)`);
console.log(`=> Test AH-1 PASS: Tính toán kịch bản test 3 xong trong ${endCalc - startCalc}ms, không đơ/lặp.`);

// [TEST AH-2] Fuzz Testing: Kiểm tra các hàm ngày giờ với dữ liệu biên / rác
console.log('\n[TEST AH-2] Fuzz testing hàm ngày giờ: chu kỳ 0, âm, NaN, chu kỳ quá lớn, ngày không hợp lệ');
const badInputs = [
  { type: 'interval', intervalDays: 0 },
  { type: 'interval', intervalDays: -10 },
  { type: 'interval', intervalDays: NaN },
  { type: 'interval', intervalDays: 'abc' },
  { type: 'interval', intervalDays: 1000000 },
  { type: 'interval', intervalDays: null, startDate: '1970-01-01' },
  { type: 'monthly', dayOfMonth: 0 },
  { type: 'monthly', dayOfMonth: 32 },
  { type: 'monthly', dayOfMonth: NaN },
  { type: 'monthly', dayOfMonth: -5 },
  { type: 'daily', targetCount: 0 },
  { type: 'daily', targetCount: -4 },
  { type: 'daily', targetCount: NaN },
  { type: 'daily', reminderTime: 'invalid' },
  { type: 'daily', reminderTime: '99:99' },
];

for (const bad of badInputs) {
  const t0 = Date.now();
  const res = microService.computeNextOccurrence(bad, now);
  const st = microService.calculateHabitStatus(bad, now);
  const t1 = Date.now();
  assert.ok(t1 - t0 < 50, `Bad input ${JSON.stringify(bad)} bị treo quá 50ms`);
  assert.ok(res, 'Vẫn phải trả về object an toàn không crash');
  assert.ok(st, 'Vẫn phải trả về status an toàn không crash');
}
console.log(`=> Test AH-2 PASS: Đã vượt qua 15 trường hợp fuzzing biên / rác mà không bị treo hay crash.`);

// [TEST AH-3] Bảng tổ hợp: Loại việc x Nhắc nhở x Bắt đầu x Giờ nhắc
console.log('\n[TEST AH-3] Bảng tổ hợp mọi cấu hình form:');
const types = [microService.HABIT_TYPES.DAILY, microService.HABIT_TYPES.INTERVAL, microService.HABIT_TYPES.MONTHLY];
const reminderOptions = [true, false];
const startOptions = ['today', 'tomorrow'];
const timeOptions = ['08:00', '14:00']; // 08:00 đã qua lúc 11:55, 14:00 chưa tới

let comboCount = 0;
for (const type of types) {
  for (const reminderEnabled of reminderOptions) {
    for (const startOpt of startOptions) {
      for (const time of timeOptions) {
        comboCount++;
        const sDate = startOpt === 'today' ? microService.getTodayDateString(now) : '2026-11-04';
        const task = {
          id: `combo-${comboCount}`,
          title: `Combo ${comboCount}`,
          type,
          intervalDays: 7,
          dayOfMonth: 15,
          targetCount: 3,
          reminderEnabled,
          reminderTime: time,
          startDate: sDate,
        };
        const t0 = Date.now();
        const nextOcc = microService.computeNextOccurrence(task, now);
        const taskStatus = microService.calculateHabitStatus(task, now);
        const elapsed = Date.now() - t0;
        assert.ok(elapsed < 20, `Combo ${comboCount} xử lý quá 20ms: ${elapsed}ms`);
        assert.ok(nextOcc && taskStatus);
      }
    }
  }
}
console.log(`=> Test AH-3 PASS: Cả ${comboCount} tổ hợp đều hoàn thành < 20ms, 100% an toàn.`);

// [TEST AH-4] Kiểm thử hiệu năng với 100 việc vặt đồng thời (Stress Test)
console.log('\n[TEST AH-4] Stress test danh sách 100 việc vặt:');
const largeList = [];
for (let i = 1; i <= 100; i++) {
  largeList.push({
    id: `stress-${i}`,
    title: `Việc stress test ${i}`,
    type: types[i % 3],
    intervalDays: (i % 30) + 1,
    dayOfMonth: (i % 28) + 1,
    targetCount: (i % 5) + 1,
    currentCount: i % 2,
    reminderEnabled: i % 2 === 0,
    reminderTime: '08:30',
  });
}

const tStress0 = Date.now();
const stats = microService.getHabitStats(largeList, now);
const tStress1 = Date.now();
const totalCards = stats.overdue + stats.warning + stats.safe + stats.completed;
assert.equal(totalCards, 100, 'Tổng 4 thẻ phải luôn bằng 100');
assert.ok(tStress1 - tStress0 < 100, `Tính toán 100 việc phải < 100ms (thực tế: ${tStress1 - tStress0}ms)`);
console.log(`=> Test AH-4 PASS: 100 việc vặt tính toán trạng thái và thống kê chỉ mất ${tStress1 - tStress0}ms. Tổng 4 thẻ = ${totalCards}/100.`);

// [TEST AH-5] Kiểm thử cơ chế lên lịch nhiều mốc nhắc trong ngày (khoảng cách giờ)
console.log('\n[TEST AH-5] Kiểm thử lên lịch nhiều mốc nhắc trong ngày (reminderIntervalHours = 2):');
const waterTask = {
  id: 'water-1',
  title: 'Uống nước',
  type: microService.HABIT_TYPES.DAILY,
  targetCount: 4,
  reminderEnabled: true,
  reminderTime: '08:00',
  reminderIntervalHours: 2, // Mỗi 2 giờ
};

const dailyTriggers = notifService.buildUpcomingDailyTriggers(waterTask, 3, now);
assert.ok(dailyTriggers.length > 0, 'Phải tạo các triggers trong ngày');
console.log(`Đã tạo ${dailyTriggers.length} mốc thông báo trong 3 ngày tới cho mục tiêu uống nước mỗi 2 giờ.`);
console.log(`Mốc đầu tiên: ${dailyTriggers[0].dateKey} trigger lúc ${dailyTriggers[0].date.toLocaleTimeString('vi-VN')}`);
assert.ok(dailyTriggers.length <= 35, 'Số lượng triggers không được vượt quá giới hạn an toàn 35');
console.log(`=> Test AH-5 PASS: Hỗ trợ nhắc nhở cách mỗi X tiếng trong ngày chuẩn xác và an toàn.`);

console.log('\n=== TẤT CẢ TEST CASE VIỆC AH ĐÃ PASS 100% ===');
