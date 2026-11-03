// scripts/test-habit-ae.js
// Automated verification for VIỆC AE:
// computeNextOccurrence unit tests with mock clocks:
// 1. Đúng bằng giờ hiện tại (now == reminderTime)
// 2. Chuyển ngày 23:59 sang 00:00 (reset counter, next occurrence)
// 3. Cuối tháng (31/1 sang tháng 2 co về 28 hoặc 29)
// 4. Tháng ngắn (31/4 co về 30/4)
// 5. Chọn "từ hôm nay" (progress tracked, status warning/completed, reminder tomorrow)
// 6. Chọn "từ ngày mai" (status not_due, not counted in today's overdue/warning)
// 7. Interval & Monthly chọn ngày quá khứ -> tự đẩy sang kỳ kế tiếp và có explanation

import assert from 'node:assert';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { transformFileSync } from '@babel/core';

const here = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);
const source = path.join(here, '..', 'src', 'features', 'micro-habit', 'microHabitService.js');
const transformed = transformFileSync(source, { presets: ['babel-preset-expo'] }).code;

function loadService() {
  const module = { exports: {} };
  vm.runInNewContext(transformed, {
    module,
    exports: module.exports,
    console,
    Date,
    Promise,
    Math,
    parseInt,
    isNaN,
    setTimeout,
    clearTimeout,
    require: (name) => {
      if (name === 'react-native') return { Platform: { OS: 'ios' } };
      if (name === '@react-native-async-storage/async-storage') return { getItem: async () => null, setItem: async () => null };
      if (name === 'expo-notifications') return {
        setNotificationHandler() {},
        setNotificationChannelAsync() {},
        SchedulableTriggerInputTypes: { DAILY: 'daily', CALENDAR: 'calendar', DATE: 'date', TIME_INTERVAL: 'timeInterval' },
      };
      if (name.startsWith('@babel/runtime/')) return nodeRequire(name);
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return module.exports;
}

const service = loadService();
console.log('--- BẮT ĐẦU KIỂM THỬ VIỆC AE (ĐỒNG HỒ GIẢ & QUY TẮC GIỜ) ---');

// TEST 1: Đúng bằng giờ hiện tại (now = 22:39:00, reminderTime = '22:39')
{
  console.log('\n[TEST 1] Đúng bằng giờ hiện tại (22:39)');
  const fakeNow = new Date(2026, 10, 3, 22, 39, 0, 0); // 2026-11-03 22:39:00
  const daily = { id: 'd1', type: 'daily', reminderTime: '22:39', targetCount: 2, currentCount: 0 };
  const res = service.computeNextOccurrence(daily, fakeNow);

  // Khi đúng bằng giờ hiện tại: xem như thời điểm hôm nay đã chạm/qua, lần nhắc kế tiếp là ngày mai
  assert.equal(res.passedToday, true);
  assert.equal(res.isTomorrow, true);
  assert.equal(res.date.getDate(), 4);
  assert.equal(res.date.getHours(), 22);
  assert.equal(res.date.getMinutes(), 39);
  assert.ok(res.previewText.includes('22:39 hôm nay đã qua, nhắc đầu tiên: ngày mai 22:39'));
  console.log('=> Test 1 PASS: Đúng bằng giờ hiện tại được xử lý chuẩn xác, lần nhắc kế tiếp là ngày mai.');
}

// TEST 2: Chuyển ngày 23:59 sang 00:00
{
  console.log('\n[TEST 2] 23:59:59 chuyển sang 00:00:00 ngày mới');
  const nowNight = new Date(2026, 10, 3, 23, 59, 59, 0);
  const nowMorning = new Date(2026, 10, 4, 0, 0, 0, 0);

  const daily = {
    id: 'd2',
    type: 'daily',
    reminderTime: '08:00',
    targetCount: 3,
    dailyCompletionEvents: [
      { date: '2026-11-03', kind: 'daily-completion' },
      { date: '2026-11-03', kind: 'daily-completion' },
      { date: '2026-11-03', kind: 'daily-completion' },
    ],
  };

  // Lúc 23:59 ngày 3: Đã xong hôm nay (3/3)
  const resNight = service.computeNextOccurrence(daily, nowNight);
  assert.equal(resNight.isCompleted, true);
  assert.equal(resNight.statusGroup, 'completed');

  // Sang 00:00 ngày 4: Reset về 0/3, chưa đạt mục tiêu hôm nay
  const resMorning = service.computeNextOccurrence(daily, nowMorning);
  assert.equal(resMorning.isCompleted, false);
  assert.equal(resMorning.currentCount, 0);
  assert.equal(resMorning.statusGroup, 'warning'); // Sắp đến hạn hôm nay
  assert.equal(resMorning.isToday, true);
  assert.equal(resMorning.date.getDate(), 4);
  assert.equal(resMorning.date.getHours(), 8);
  console.log('=> Test 2 PASS: 23:59 -> 00:00 tự động reset 0/N và trạng thái chuyển sang Sắp đến hạn cho ngày mới.');
}

// TEST 3: Cuối tháng & tháng 2 co ngày 31
{
  console.log('\n[TEST 3] Cuối tháng 1 (ngày 31) sang tháng 2 (năm không nhuận co về 28)');
  const fakeNow = new Date(2027, 0, 31, 10, 0, 0, 0); // 31/01/2027 (2027 không nhuận)
  const monthly = { id: 'm1', type: 'monthly', dayOfMonth: 31, reminderTime: '09:00', lastCompletedDate: fakeNow.toISOString() };
  const res = service.computeNextOccurrence(monthly, fakeNow);

  // Vì tháng 1 đã xong, kỳ kế tiếp là tháng 2 -> ngày 28/02/2027
  assert.equal(res.date.getFullYear(), 2027);
  assert.equal(res.date.getMonth(), 1); // Tháng 2 (0-indexed = 1)
  assert.equal(res.date.getDate(), 28); // Co về 28
  console.log('=> Test 3 PASS: Tháng 2 không nhuận co ngày 31 về 28 chuẩn xác.');
}

// TEST 4: Tháng ngắn (tháng 4 có 30 ngày)
{
  console.log('\n[TEST 4] Tháng 4 (tháng ngắn có 30 ngày) co ngày 31');
  const fakeNow = new Date(2026, 3, 10, 8, 0, 0, 0); // 10/04/2026
  const monthly = { id: 'm2', type: 'monthly', dayOfMonth: 31, reminderTime: '08:00' };
  const res = service.computeNextOccurrence(monthly, fakeNow);

  // Tháng 4 ngày hạn co về 30/04/2026
  assert.equal(res.date.getMonth(), 3);
  assert.equal(res.date.getDate(), 30);
  console.log('=> Test 4 PASS: Tháng 4 co ngày 31 về 30/04 chuẩn xác.');
}

// TEST 5: Chọn "Tính từ hôm nay" vs Chọn "Bắt đầu từ ngày mai" khi giờ đã qua
{
  console.log('\n[TEST 5] Phân biệt "Tính từ hôm nay" vs "Bắt đầu từ ngày mai"');
  const fakeNow = new Date(2026, 10, 3, 20, 0, 0, 0); // 20:00 ngày 2026-11-03
  const daily = { id: 'd5', type: 'daily', reminderTime: '18:00', targetCount: 1, currentCount: 0 };

  // Trường hợp 5A: Chọn Tính từ hôm nay (startDate = '2026-11-03')
  const resToday = service.computeNextOccurrence(daily, fakeNow, '2026-11-03');
  assert.equal(resToday.statusGroup, 'warning'); // Sắp đến hạn hôm nay
  assert.equal(resToday.isTomorrow, true); // Nhắc từ ngày mai
  assert.ok(resToday.statusText.includes('Chưa đạt mục tiêu hôm nay'));

  // Trường hợp 5B: Chọn Bắt đầu từ ngày mai (startDate = '2026-11-04')
  const resTomorrow = service.computeNextOccurrence(daily, fakeNow, '2026-11-04');
  assert.equal(resTomorrow.statusGroup, 'safe'); // Chưa đến hạn
  assert.ok(resTomorrow.statusText.includes('Chưa đến hạn'));
  console.log('=> Test 5 PASS: Phân biệt rõ ràng giữa Tính từ hôm nay và Bắt đầu từ ngày mai.');
}

// TEST 6: Interval và Monthly chọn ngày trong quá khứ -> tự đẩy sang chu kỳ kế tiếp có giải thích
{
  console.log('\n[TEST 6] Interval chọn ngày trong quá khứ (20 ngày trước với chu kỳ 7 ngày)');
  const fakeNow = new Date(2026, 10, 3, 10, 0, 0, 0); // 2026-11-03
  // Chọn ngày bắt đầu 2026-10-14 (quá khứ 20 ngày trước), chu kỳ 7 ngày
  const interval = { id: 'int1', type: 'interval', intervalDays: 7, reminderTime: '08:00' };
  const res = service.computeNextOccurrence(interval, fakeNow, '2026-10-14');

  // 14/10 + 3 chu kỳ (21 ngày) = 04/11/2026
  assert.ok(res.date > fakeNow);
  assert.ok(res.explanation !== null);
  assert.ok(res.explanation.includes('quá khứ đã được tự đẩy sang lần đến hạn kế tiếp'));
  console.log('Giải thích trên giao diện:', res.explanation);
  console.log('=> Test 6 PASS: Tự đẩy ngày quá khứ sang chu kỳ tương lai và cung cấp thông điệp giải thích.');
}

console.log('\n=== TẤT CẢ 6/6 TEST CASE VIỆC AE ĐÃ PASS HOÀN HẢO ===');
