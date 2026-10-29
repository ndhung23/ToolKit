// src/features/micro-habit/microHabitService.js
// Logic tính toán chu kỳ, kiểm tra hạn chót, màu sắc cảnh báo và lưu trữ dữ liệu việc vặt

import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEY_HABITS = '@toolkit_micro_habits_v1';

export const HABIT_TYPES = {
  INTERVAL: 'interval', // Đếm ngược theo số ngày (mỗi X ngày)
  MONTHLY: 'monthly',   // Cố định ngày X hàng tháng
  DAILY: 'daily',       // Lặp lại số lần trong ngày
};

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

// Tính khoảng cách ngày: (targetDate - baseDate)
export function getDaysDiff(targetDate, baseDate = new Date()) {
  const t = getMidnight(targetDate).getTime();
  const b = getMidnight(baseDate).getTime();
  return Math.round((t - b) / (1000 * 60 * 60 * 24));
}

/**
 * Tính toán trạng thái hạn chót & màu sắc cảnh báo cho từng mục
 * @param {object} item 
 * @returns {object} { daysRemaining, urgency: 'overdue'|'warning'|'safe', statusText, progress: 0..1, dueDate }
 */
export function calculateHabitStatus(item) {
  const now = new Date();
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

    let urgency = 'safe';
    let statusText = `Còn ${daysRemaining} ngày`;

    if (daysRemaining < 0) {
      urgency = 'overdue';
      statusText = `Quá hạn ${Math.abs(daysRemaining)} ngày!`;
    } else if (daysRemaining === 0) {
      urgency = 'overdue';
      statusText = 'Hôm nay là hạn chót!';
    } else if (daysRemaining <= 3 || progress >= 0.8) {
      urgency = 'warning';
      statusText = `Sắp đến hạn (còn ${daysRemaining} ngày)`;
    }

    return {
      daysRemaining,
      daysPassed,
      urgency,
      statusText,
      progress,
      dueDate,
    };
  }

  // 2. CỐ ĐỊNH NGÀY HÀNG THÁNG (MONTHLY)
  if (item.type === HABIT_TYPES.MONTHLY) {
    const targetDay = Math.min(31, Math.max(1, parseInt(item.dayOfMonth || 1, 10)));
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Xác định ngày hạn tháng này
    let dueDate = new Date(currentYear, currentMonth, targetDay);

    // Nếu đã hoàn thành trong chu kỳ tháng này (dựa vào lastCompletedDate)
    if (item.lastCompletedDate) {
      const lastDone = new Date(item.lastCompletedDate);
      if (lastDone.getFullYear() === currentYear && lastDone.getMonth() === currentMonth && lastDone.getDate() >= targetDay) {
        // Đã hoàn thành kỳ này -> chuyển sang tháng sau
        dueDate = new Date(currentYear, currentMonth + 1, targetDay);
      }
    }

    const daysRemaining = getDaysDiff(dueDate, now);

    let urgency = 'safe';
    let statusText = `Ngày ${targetDay} hàng tháng (còn ${daysRemaining} ngày)`;

    if (daysRemaining < 0) {
      urgency = 'overdue';
      statusText = `Quá hạn đóng ${Math.abs(daysRemaining)} ngày!`;
    } else if (daysRemaining === 0) {
      urgency = 'overdue';
      statusText = 'Hôm nay đến hạn!';
    } else if (daysRemaining <= 3) {
      urgency = 'warning';
      statusText = `Sắp đến ngày đóng (còn ${daysRemaining} ngày)`;
    }

    return {
      daysRemaining,
      urgency,
      statusText,
      progress: daysRemaining <= 0 ? 1 : Math.max(0, 1 - daysRemaining / 30),
      dueDate,
    };
  }

  // 3. ĐẾM LẦN TRONG NGÀY (DAILY COUNTER)
  if (item.type === HABIT_TYPES.DAILY) {
    const target = Math.max(1, parseInt(item.targetCount || 1, 10));
    // Tự động reset về 0 nếu đã qua 00:00 ngày mới
    const current = item.lastDailyDate === todayStr ? (item.currentCount || 0) : 0;
    const progress = Math.min(1, current / target);
    const isCompleted = current >= target;

    let urgency = 'safe';
    let statusText = `Đã xong ${current}/${target} ${item.unit || 'lần'}`;

    if (isCompleted) {
      urgency = 'safe';
      statusText = `Hoàn thành hôm nay! (${current}/${target})`;
    } else if (current === 0) {
      urgency = 'warning';
      statusText = `Chưa làm lần nào (0/${target} ${item.unit || 'lần'})`;
    } else {
      urgency = 'warning';
      statusText = `Tiến độ hôm nay: ${current}/${target} ${item.unit || 'lần'}`;
    }

    return {
      daysRemaining: 0,
      urgency,
      statusText,
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

// Dữ liệu mẫu ban đầu đúng như yêu cầu của người dùng
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
        if (item.type === HABIT_TYPES.DAILY && item.lastDailyDate !== todayStr) {
          return {
            ...item,
            currentCount: 0,
            lastDailyDate: todayStr,
          };
        }
        return item;
      });
      return validated;
    }
    return DEFAULT_HABITS;
  } catch {
    return DEFAULT_HABITS;
  }
}

