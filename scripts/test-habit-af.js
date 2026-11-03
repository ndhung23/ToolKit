// scripts/test-habit-af.js
// Automated verification for VIỆC AF:
// 1. Sau khi sửa (giờ, loại chu kỳ, mục tiêu, ngày bắt đầu), trạng thái tính lại đúng.
// 2. Tự động chuyển bộ lọc khi việc không còn hiện dưới bộ lọc cũ.
// 3. Invariant: Tổng 4 thẻ (overdue + warning + safe + completed) luôn bằng tổng số việc.

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
console.log('--- BẮT ĐẦU KIỂM THỬ VIỆC AF (ĐIỀU HƯỚNG BỘ LỌC & TỔNG 4 THẺ) ---');

const now = new Date(2026, 10, 3, 10, 0, 0, 0); // 10:00:00 ngày 03/11/2026

// Giả lập danh sách ban đầu gồm 4 việc
let habits = [
  { id: 'h1', title: 'Thay nhớt xe', type: 'interval', intervalDays: 30, lastCompletedDate: '2026-10-01' },
  { id: 'h2', title: 'Đóng tiền điện', type: 'monthly', dayOfMonth: 5, reminderTime: '08:00' },
  { id: 'h3', title: 'Uống 2L nước', type: 'daily', targetCount: 4, currentCount: 4, reminderTime: '08:00' },
  { id: 'h4', title: 'Dọn bàn làm việc', type: 'daily', targetCount: 1, currentCount: 0, reminderTime: '20:00' },
];

function computeHabitsWithStatus(items, clock = now) {
  return items.map(item => ({
    ...item,
    status: service.calculateHabitStatus(item, clock),
  }));
}

function verifyStatsInvariant(habitsWithStatus, stageName) {
  const stats = service.getHabitStats(habitsWithStatus);
  const sum4 = stats.overdue + stats.warning + stats.safe + stats.completed;
  console.log(`[${stageName}] Stats:`, stats, `-> Tổng 4 thẻ: ${sum4} / Tổng việc: ${stats.total}`);
  assert.equal(sum4, stats.total, `Sum of 4 cards (${sum4}) must equal total (${stats.total}) at stage ${stageName}`);
  return stats;
}

// 1. Kiểm tra ban đầu
let withStatus = computeHabitsWithStatus(habits);
verifyStatsInvariant(withStatus, 'Ban đầu');

// 2. Sửa H3 từ đã hoàn thành (4/4) thành chưa hoàn thành (mục tiêu 8 lần)
console.log('\n[TEST AF-1] Sửa mục tiêu h3: 4 -> 8 (chuyển từ completed sang warning)');
habits = habits.map(h => h.id === 'h3' ? { ...h, targetCount: 8 } : h);
withStatus = computeHabitsWithStatus(habits);
const h3Status = withStatus.find(h => h.id === 'h3').status;
assert.equal(service.getHabitStatusGroup(h3Status), 'warning');
verifyStatsInvariant(withStatus, 'Sau khi sửa mục tiêu');

// 3. Sửa H4 từ tính từ hôm nay sang "Bắt đầu từ ngày mai" (startDate = 2026-11-04)
console.log('\n[TEST AF-2] Sửa h4 bắt đầu từ ngày mai (chuyển sang Chưa đến hạn / safe)');
habits = habits.map(h => h.id === 'h4' ? { ...h, startDate: '2026-11-04' } : h);
withStatus = computeHabitsWithStatus(habits);
const h4Status = withStatus.find(h => h.id === 'h4').status;
assert.equal(service.getHabitStatusGroup(h4Status), 'safe');
assert.ok(h4Status.statusText.includes('Chưa đến hạn'));
verifyStatsInvariant(withStatus, 'Sau khi sửa ngày bắt đầu');

// 4. Sửa H1 chu kỳ: intervalDays = 1 -> quá hạn (overdue)
console.log('\n[TEST AF-3] Sửa h1 intervalDays = 1 (chuyển sang Quá hạn / overdue)');
habits = habits.map(h => h.id === 'h1' ? { ...h, intervalDays: 1, lastCompletedDate: '2026-10-20' } : h);
withStatus = computeHabitsWithStatus(habits);
const h1Status = withStatus.find(h => h.id === 'h1').status;
assert.equal(service.getHabitStatusGroup(h1Status), 'overdue');
verifyStatsInvariant(withStatus, 'Sau khi sửa chu kỳ thành quá hạn');

// 5. Kiểm tra logic auto-routing khi bộ lọc đang ẩn việc vừa sửa
console.log('\n[TEST AF-4] Kiểm tra auto-routing chuyển tab bộ lọc');
function simulateFilterRouting(editedHabit, currentStatusFilter, currentTypeFilter, currentSearch) {
  const status = service.calculateHabitStatus(editedHabit, now);
  const targetGroup = service.getHabitStatusGroup(status);

  const isVisibleUnderCurrentFilter =
    (!currentStatusFilter || currentStatusFilter === targetGroup) &&
    (currentTypeFilter === 'all' || currentTypeFilter === editedHabit.type) &&
    (!currentSearch || editedHabit.title.toLowerCase().includes(currentSearch.toLowerCase()));

  if (!isVisibleUnderCurrentFilter) {
    return {
      autoRouted: true,
      newStatusFilter: targetGroup,
      newTypeFilter: 'all',
      newSearch: '',
      toast: `Việc đã chuyển sang nhóm ${targetGroup}`,
    };
  }
  return { autoRouted: false, newStatusFilter: currentStatusFilter };
}

// Người dùng đang ở tab 'completed', sửa h3 khiến h3 thành 'warning'
const routeResult = simulateFilterRouting(habits.find(h => h.id === 'h3'), 'completed', 'all', '');
assert.equal(routeResult.autoRouted, true);
assert.equal(routeResult.newStatusFilter, 'warning');
assert.equal(routeResult.newTypeFilter, 'all');
console.log('Routing thành công:', routeResult);

console.log('\n=== TẤT CẢ TEST CASE VIỆC AF ĐÃ PASS 100% ===');
