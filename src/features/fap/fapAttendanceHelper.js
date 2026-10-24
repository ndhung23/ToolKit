// src/utils/fapAttendanceHelper.js
// Bộ công cụ quản lý điểm danh FAP & Cảnh báo vắng (Absent Alert) cuối ca học +10 phút

import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

// Định nghĩa 6 Slot học chuẩn cơ sở Hà Nội / Hòa Lạc kèm mốc giờ kết thúc & giờ cảnh báo vắng (+10p)
export const FAP_TIMESLOTS = [
  {
    slot: 1,
    time: '07h30 - 09h50',
    startTime: '07:30',
    endTime: '09:50',
    alertTime: '10:00', // Cuối slot + 10 phút
    endHour: 9,
    endMinute: 50,
    alertHour: 10,
    alertMinute: 0,
  },
  {
    slot: 2,
    time: '10h00 - 12h20',
    startTime: '10:00',
    endTime: '12:20',
    alertTime: '12:30', // Cuối slot + 10 phút
    endHour: 12,
    endMinute: 20,
    alertHour: 12,
    alertMinute: 30,
  },
  {
    slot: 3,
    time: '12h50 - 15h10',
    startTime: '12:50',
    endTime: '15:10',
    alertTime: '15:20', // Cuối slot + 10 phút
    endHour: 15,
    endMinute: 10,
    alertHour: 15,
    alertMinute: 20,
  },
  {
    slot: 4,
    time: '15h20 - 17h40',
    startTime: '15:20',
    endTime: '17:40',
    alertTime: '17:50', // Cuối slot + 10 phút
    endHour: 17,
    endMinute: 40,
    alertHour: 17,
    alertMinute: 50,
  },
  {
    slot: 5,
    time: '17h50 - 20h10',
    startTime: '17:50',
    endTime: '20:10',
    alertTime: '20:20', // Cuối slot + 10 phút
    endHour: 20,
    endMinute: 10,
    alertHour: 20,
    alertMinute: 20,
  },
  {
    slot: 6,
    time: '20h20 - 22h40',
    startTime: '20:20',
    endTime: '22:40',
    alertTime: '22:50', // Cuối slot + 10 phút
    endHour: 22,
    endMinute: 40,
    alertHour: 22,
    alertMinute: 50,
  },
];

// Trạng thái điểm danh FAP
export const ATTENDANCE_STATUS = {
  ABSENT: 'Absent', // Vắng mặt -> CẦN CẢNH BÁO
  PRESENT: 'Present', // Có mặt -> Không cần cảnh báo
  NOT_YET: 'Not yet', // Chưa điểm danh -> Bỏ qua
};

/**
 * Lấy thông tin ngày hiện tại theo chuẩn FAP Việt Nam (Thứ 2 = 2, ..., Thứ 7 = 7, CN = 8)
 */
export function getCurrentVietnamDayInfo(now = new Date()) {
  const jsDay = now.getDay(); // 0 = CN, 1 = T2, 2 = T3, 3 = T4, 4 = T5, 5 = T6, 6 = T7
  const dayIndex = jsDay === 0 ? 8 : jsDay + 1; // 2..8
  const dayNames = {
    2: 'Thứ 2',
    3: 'Thứ 3',
    4: 'Thứ 4',
    5: 'Thứ 5',
    6: 'Thứ 6',
    7: 'Thứ 7',
    8: 'Chủ nhật',
  };
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}`;
  const fullDateStr = `${dayNames[dayIndex]}, ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

  return {
    dayIndex,
    dayName: dayNames[dayIndex],
    dateStr,
    fullDateStr,
  };
}

/**
 * Tự động nhận diện Slot (1..6) từ chuỗi thời gian (ví dụ: '10:00 - 12:20' -> Slot 2)
 */
export function detectSlotFromTimeStr(timeStr = '') {
  if (!timeStr) return 1;
  const m = timeStr.match(/(\d{1,2})[h:](\d{2})/i);
  if (!m) return 1;
  const hour = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const totalMin = hour * 60 + min;

  if (totalMin <= 9 * 60 + 50) return 1; // Trước hoặc bằng 09:50 -> Slot 1
  if (totalMin <= 12 * 60 + 30) return 2; // Trước hoặc bằng 12:30 -> Slot 2
  if (totalMin <= 15 * 60 + 10) return 3; // Trước hoặc bằng 15:10 -> Slot 3
  if (totalMin <= 17 * 60 + 40) return 4; // Trước hoặc bằng 17:40 -> Slot 4
  if (totalMin <= 20 * 60 + 10) return 5; // Trước hoặc bằng 20:10 -> Slot 5
  return 6; // Sau 20:10 -> Slot 6
}

/**
 * Trích xuất danh sách ca học HÔM NAY từ tất cả các môn đã cào Full (Report/Attendance)
 */
export function extractTodaySlotsFromCourses(courses = [], now = new Date()) {
  if (!Array.isArray(courses) || courses.length === 0) return [];
  const pad = (n) => String(n).padStart(2, '0');
  const todayDateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const shortToday = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}`;
  const { dayName } = getCurrentVietnamDayInfo(now);

  const matched = [];
  courses.forEach((course) => {
    const sessions = Array.isArray(course.sessions) ? course.sessions : [];
    sessions.forEach((s) => {
      const sDate = s.date || '';
      if (sDate === todayDateStr || sDate.includes(shortToday)) {
        const slotNum = s.slot || detectSlotFromTimeStr(s.time);
        const cfg = FAP_TIMESLOTS.find((t) => t.slot === slotNum);
        matched.push({
          id: `today_course_${course.courseCode}_${s.sessionNumber || matched.length}`,
          slot: slotNum,
          dayName,
          date: s.date,
          time: s.time || (cfg ? cfg.time : '07h30 - 09h50'),
          alertTime: cfg ? cfg.alertTime : '10:00',
          subjectCode: course.courseCode,
          subjectName: course.courseName || course.courseCode,
          room: s.room || 'DE-422',
          lecturer: s.lecturer || 'Giảng viên',
          status: s.status || ATTENDANCE_STATUS.NOT_YET,
          notified: false,
          sessionNumber: s.sessionNumber,
          totalSlots: course.totalSlots,
        });
      }
    });
  });

  // Sắp xếp ca học theo thứ tự Slot từ 1 đến 6
  return matched.sort((a, b) => a.slot - b.slot);
}

/**
 * Trích xuất danh sách ca học TUẦN NÀY từ tất cả các môn đã cào Full (Report/Attendance)
 */
export function extractWeeklySlotsFromCourses(courses = [], now = new Date()) {
  if (!Array.isArray(courses) || courses.length === 0) return [];

  // Tìm Thứ 2 của tuần hiện tại
  const jsDay = now.getDay();
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  // Tạo tập hợp các ngày trong tuần (Thứ 2 .. Chủ nhật)
  const pad = (n) => String(n).padStart(2, '0');
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push({
      dateStr: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
      shortDate: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
      dayIndex: i + 2, // 2..8
      dayName: i === 6 ? 'Chủ nhật' : `Thứ ${i + 2}`,
    });
  }

  const result = [];
  courses.forEach((course) => {
    const sessions = Array.isArray(course.sessions) ? course.sessions : [];
    sessions.forEach((s) => {
      const sDate = s.date || '';
      const matchedDay = weekDays.find((wd) => sDate === wd.dateStr || sDate.includes(wd.shortDate));
      if (matchedDay) {
        const slotNum = s.slot || detectSlotFromTimeStr(s.time);
        const cfg = FAP_TIMESLOTS.find((t) => t.slot === slotNum);
        result.push({
          id: `week_course_${course.courseCode}_${s.sessionNumber || result.length}`,
          slot: slotNum,
          dayIndex: matchedDay.dayIndex,
          dayName: matchedDay.dayName,
          date: matchedDay.shortDate,
          fullDate: s.date,
          time: s.time || (cfg ? cfg.time : '07h30 - 09h50'),
          alertTime: cfg ? cfg.alertTime : '10:00',
          subjectCode: course.courseCode,
          subjectName: course.courseName || course.courseCode,
          room: s.room || 'DE-422',
          lecturer: s.lecturer || 'Giảng viên',
          status: s.status || ATTENDANCE_STATUS.NOT_YET,
          notified: false,
          sessionNumber: s.sessionNumber,
          totalSlots: course.totalSlots,
        });
      }
    });
  });

  return result.sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return a.slot - b.slot;
  });
}

/**
 * Tìm ca học tiếp theo sắp tới trong tuần
 */
export function getNextUpcomingSlot(weeklySlots = [], now = new Date()) {
  if (!Array.isArray(weeklySlots) || weeklySlots.length === 0) return null;
  const { dayIndex } = getCurrentVietnamDayInfo(now);

  // Tìm các ca học trong tuần có dayIndex > hôm nay
  const futureSlots = weeklySlots.filter((s) => (s.dayIndex || 2) > dayIndex);
  if (futureSlots.length > 0) return futureSlots[0];

  // Nếu đã qua cuối tuần, ca học tiếp theo là ca đầu tiên của tuần tới
  return weeklySlots[0];
}

/**
 * Lọc danh sách ca học diễn ra trong ngày hôm nay từ danh sách ca học cả tuần
 */
export function filterSlotsForToday(weeklySlots = [], now = new Date()) {
  if (!Array.isArray(weeklySlots) || weeklySlots.length === 0) return [];
  const { dayIndex, dateStr } = getCurrentVietnamDayInfo(now);

  return weeklySlots
    .filter((slot) => {
      if (slot.dayIndex !== undefined && slot.dayIndex !== null) {
        return Number(slot.dayIndex) === Number(dayIndex);
      }
      if (slot.date) {
        return slot.date === dateStr || slot.date.includes(dateStr);
      }
      return false;
    })
    .sort((a, b) => (Number(a.slot) || 1) - (Number(b.slot) || 1));
}

/**
 * Danh sách mẫu dự phòng khi người dùng muốn kiểm tra thử chuông báo
 */
export const SAMPLE_TODAY_SLOTS = [
  {
    id: 'sample_slot_1',
    slot: 1,
    subjectCode: 'SDN302',
    subjectName: 'Server-Side development with NodeJS, Express, MongoDB',
    room: 'BE-212',
    time: '07h30 - 09h50',
    alertTime: '10:00',
    status: ATTENDANCE_STATUS.PRESENT,
    lecturer: 'NguyenVV',
    notified: false,
  },
  {
    id: 'sample_slot_2',
    slot: 2,
    subjectCode: 'MMA301',
    subjectName: 'Multiplatform Mobile App Development with React Native',
    room: 'DE-422',
    time: '10h00 - 12h20',
    alertTime: '12:30',
    status: ATTENDANCE_STATUS.ABSENT,
    lecturer: 'TranTA',
    notified: false,
  },
];

/**
 * Tính toán mốc Date cảnh báo (+10 phút sau khi kết thúc Slot)
 */
export function getSlotAlertTimestamp(slotNumber, dateObj = new Date()) {
  const cfg = FAP_TIMESLOTS.find((s) => s.slot === Number(slotNumber)) || FAP_TIMESLOTS[0];
  const target = new Date(dateObj);
  target.setHours(cfg.alertHour, cfg.alertMinute, 0, 0);
  return target;
}

/**
 * Kiểm tra xem slot học có bị Absent và đã chạm mốc giờ cảnh báo (hết ca + 10p) hay chưa
 */
export function checkSlotAbsentAlert(slotItem, now = new Date()) {
  const isAbsent =
    slotItem.status === ATTENDANCE_STATUS.ABSENT ||
    slotItem.status?.toLowerCase() === 'absent' ||
    slotItem.status?.toLowerCase() === 'vắng' ||
    slotItem.status?.toLowerCase() === 'vắng mặt';

  if (!isAbsent || slotItem.notified) {
    return { shouldAlert: false, isAbsent, diffMs: 0, alertTimeText: '--:--' };
  }

  const alertDate = getSlotAlertTimestamp(slotItem.slot, now);
  const diffMs = alertDate.getTime() - now.getTime();
  const pad = (n) => String(n).padStart(2, '0');
  const alertTimeText = `${pad(alertDate.getHours())}:${pad(alertDate.getMinutes())}`;

  return {
    shouldAlert: diffMs <= 0,
    isAbsent: true,
    diffMs,
    alertDate,
    alertTimeText,
  };
}

/**
 * Kích hoạt cảnh báo chuông và Push Notification khi sinh viên bị đánh Absent
 */
export async function triggerAbsentNotification(slotItem) {
  const cfg = FAP_TIMESLOTS.find((s) => s.slot === Number(slotItem.slot));
  const timeDesc = cfg ? cfg.time : slotItem.time || 'Ca học';
  const alertTimeStr = cfg ? cfg.alertTime : 'Cuối ca + 10 phút';

  const title = `🚨 CẢNH BÁO ĐIỂM DANH: Bạn bị vắng mặt (Absent)!`;
  const body = `Môn ${slotItem.subjectCode} (${timeDesc}) tại phòng ${slotItem.room || 'học'} bị đánh VẮNG MẶT lúc ${alertTimeStr}. Vui lòng liên hệ giảng viên nếu có nhầm lẫn!`;

  Alert.alert(
    title,
    body,
    [
      { text: 'Kiểm tra FAP ngay', style: 'destructive' },
      { text: 'Đã rõ', style: 'default' },
    ]
  );

  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (window.Notification.permission === 'granted') {
          new window.Notification(title, { body });
        } else if (window.Notification.permission !== 'denied') {
          const perm = await window.Notification.requestPermission();
          if (perm === 'granted') new window.Notification(title, { body });
        }
      }
    } catch {}
    return;
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus === 'granted') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 250, 250],
        },
        trigger: null,
      });
    }
  } catch (err) {
    console.warn('[FAP Attendance] Không thể gửi Push Notification:', err?.message);
  }
}
