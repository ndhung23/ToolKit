// src/utils/fapExamHelper.js
// Bộ công cụ hỗ trợ tích hợp cổng FAP (fap.fpt.edu.vn), bóc tách lịch thi & tính toán thời gian nhắc nhở

import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

export const FAP_CAMPUSES = [
  { id: 'HN', name: 'Cơ sở Hà Nội (HN)' },
  { id: 'HCM', name: 'Cơ sở TP. Hồ Chí Minh (HCM)' },
  { id: 'DN', name: 'Cơ sở Đà Nẵng (DN)' },
  { id: 'CT', name: 'Cơ sở Cần Thơ (CT)' },
  { id: 'QN', name: 'Cơ sở Quy Nhơn (QN)' },
];

export const REMINDER_PRESETS = [
  { label: '1 phút', minutes: 1 },
  { label: '5 phút', minutes: 5 },
  { label: '15 phút', minutes: 15 },
  { label: '30 phút', minutes: 30 },
  { label: '1 giờ', minutes: 60 },
  { label: '2 giờ', minutes: 120 },
  { label: '1 ngày', minutes: 1440 },
];

export const SAMPLE_SSO_ACCOUNTS = [
  {
    id: 'acc_1',
    name: 'Sinh Viên FPT',
    studentId: 'HE180000',
    program: 'BIT_SE_19C_NJ',
    cohort: '19',
    email: 'sinhvien.fpt@gmail.com',
    fptEmail: 'sinhvienhe180000@fpt.edu.vn',
    campus: 'Cơ sở Hà Nội (HN)',
    status: 'HD',
  },
  {
    id: 'acc_2',
    name: 'Nguyễn Văn A (Demo)',
    studentId: 'HE180001',
    program: 'BIT_SE_19C_NJ',
    cohort: '19',
    email: 'sinhvien.demo@gmail.com',
    fptEmail: 'sinhvienhe180001@fpt.edu.vn',
    campus: 'Cơ sở Hà Nội (HN)',
    status: 'HD',
  },
  {
    id: 'acc_3',
    name: 'FPT Student',
    studentId: 'HE180888',
    program: 'BIT_SE_19C',
    cohort: '19',
    email: 'student.demo@gmail.com',
    fptEmail: 'studenthe180888@fpt.edu.vn',
    campus: 'Cơ sở Hà Nội (HN)',
    status: 'HD',
  },
];

// Danh sách lịch thi chuẩn theo hệ thống FAP (/ExamSchedule)
export const INITIAL_FAP_EXAMS = [
  {
    id: 'exam_sdn302_pe',
    date: '08/11/2026',
    time: '10h00-12h00',
    room: 'BE-212',
    subjectCode: 'SDN302',
    subjectName: 'Server-Side development with NodeJS, Express, and MongoDB',
    examForm: 'Practical_Exam (PEA client)',
    examType: 'PE',
    publishDate: '21/11/2026',
    note: '',
    reminderEnabled: true,
    customReminderMinutes: null, // null = dùng cấu hình mặc định chung
    notified: false,
  },
  {
    id: 'exam_mma301_pe',
    date: '10/11/2026',
    time: '07h30-09h30',
    room: 'AL-R204',
    subjectCode: 'MMA301',
    subjectName: 'Multiplatform Mobile App Development',
    examForm: 'Practical_Exam (PEA client)',
    examType: 'PE',
    publishDate: '23/11/2026',
    note: 'Mang theo cáp sạc thiết bị di động',
    reminderEnabled: true,
    customReminderMinutes: null,
    notified: false,
  },
  {
    id: 'exam_sdn302_fe',
    date: '14/11/2026',
    time: '13h00-14h30',
    room: 'BE-305',
    subjectCode: 'SDN302',
    subjectName: 'Server-Side development with NodeJS, Express, and MongoDB',
    examForm: 'Multiple_Choice (EOS client)',
    examType: 'FE',
    publishDate: '25/11/2026',
    note: 'Cập nhật EOS client bản mới nhất',
    reminderEnabled: true,
    customReminderMinutes: 60,
    notified: false,
  },
  {
    id: 'exam_swd392_fe',
    date: '17/11/2026',
    time: '09h50-11h20',
    room: 'DE-210',
    subjectCode: 'SWD392',
    subjectName: 'SW Architecture and Design',
    examForm: 'Multiple_Choice (EOS client)',
    examType: 'FE',
    publishDate: '28/11/2026',
    note: '',
    reminderEnabled: true,
    customReminderMinutes: null,
    notified: false,
  },
];

/**
 * Chuyển đổi chuỗi ngày ("08/11/2026") và giờ ("10h00-12h00" hoặc "07:30-09:30") thành Date bắt đầu thi
 */
export function parseExamStartTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  try {
    const cleanDate = dateStr.trim();
    const parts = cleanDate.split(/[\/\-]/);
    if (parts.length !== 3) return null;

    let day, month, year;
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }

    // Tách giờ bắt đầu từ "10h00-12h00" hoặc "10:00 - 12:00" hoặc "10h00"
    const startPart = timeStr.trim().split(/[\-–~]/)[0].trim();
    const timeMatch = startPart.match(/(\d{1,2})[h:\.](\d{1,2})/i);
    let hours = 7;
    let minutes = 30;
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
    }

    const d = new Date(year, month, day, hours, minutes, 0, 0);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Định dạng thời gian còn lại tới giờ thi hoặc giờ nhắc nhở
 */
export function getExamTimeStatus(exam, defaultReminderMinutes = 30, now = new Date()) {
  const startDate = parseExamStartTime(exam.date, exam.time);
  if (!startDate) {
    return {
      valid: false,
      isPast: false,
      isReminderReached: false,
      diffMs: 0,
      countdownText: 'Chưa xác định thời gian',
      reminderTimeText: '--:--',
    };
  }

  const reminderMins =
    exam.customReminderMinutes !== null && exam.customReminderMinutes !== undefined
      ? Number(exam.customReminderMinutes)
      : Number(defaultReminderMinutes);

  const reminderDate = new Date(startDate.getTime() - reminderMins * 60 * 1000);
  const diffMs = startDate.getTime() - now.getTime();
  const diffToReminderMs = reminderDate.getTime() - now.getTime();

  const pad = (n) => String(n).padStart(2, '0');
  const reminderTimeText = `${pad(reminderDate.getHours())}:${pad(reminderDate.getMinutes())} ngày ${pad(reminderDate.getDate())}/${pad(reminderDate.getMonth() + 1)}`;

  if (diffMs <= 0) {
    return {
      valid: true,
      isPast: true,
      isReminderReached: false,
      diffMs,
      diffToReminderMs,
      reminderMins,
      startDate,
      reminderDate,
      countdownText: 'Đã đến / Qua giờ thi',
      reminderTimeText,
    };
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;
  const secs = Math.floor((diffMs % 60000) / 1000);

  let countdownText = '';
  if (days > 0) {
    countdownText = `Còn ${days} ngày ${hours} giờ ${mins} phút`;
  } else if (hours > 0) {
    countdownText = `Còn ${hours} giờ ${mins} phút ${secs}s`;
  } else {
    countdownText = `Còn ${mins} phút ${secs} giây`;
  }

  // Đã bước vào khung thời gian nhắc nhở (từ thời điểm reminderDate đến lúc thi)
  const isReminderReached = diffToReminderMs <= 0 && diffMs > 0;

  return {
    valid: true,
    isPast: false,
    isReminderReached,
    diffMs,
    diffToReminderMs,
    reminderMins,
    startDate,
    reminderDate,
    countdownText,
    reminderTimeText,
  };
}

/**
 * Bóc tách dữ liệu lịch thi từ fap.fpt.edu.vn (hỗ trợ cả dạng bảng Table, dạng thẻ Card tiếng Anh/Việt)
 */
export function parseFapExamScheduleRaw(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return [];
  const results = [];

  const cleanText = rawInput
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, ' ')
    .trim();

  const lines = cleanText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let current = null;
  let lastKey = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    // 1. Kiểm tra định dạng 1 dòng có Tab (Table row): Date + Time + Room + Subject
    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
    const timeMatch = line.match(/(\d{1,2}[h:]\d{2}\s*[\-–]\s*\d{1,2}[h:]\d{2})/i);
    if (dateMatch && timeMatch && (line.includes('\t') || line.split(/\s{2,}/).length >= 4)) {
      const cols = line.split(/\t+|\s{2,}/).map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 4) {
        const subRaw = cols[3] || '';
        const sp = subRaw.split(/\s*-\s*/);
        results.push({
          id: `fap_line_${Date.now()}_${results.length}`,
          date: dateMatch[1],
          time: timeMatch[1].replace(/\s+/g, ''),
          room: cols[2] || 'BE-212',
          subjectCode: sp[0].trim(),
          subjectName: sp.slice(1).join(' - ').trim() || subRaw,
          examForm: cols[4] || 'Practical_Exam (PEA client)',
          examType: cols[5] || 'PE',
          publishDate: cols[6] || '',
          note: '',
          reminderEnabled: true,
          customReminderMinutes: null,
          notified: false,
        });
        continue;
      }
    }

    // 2. Kiểm tra định dạng Thẻ Card (Multiline: DATE, TIME, ROOM, SUBJECT...)
    if (/^(DATE|NGÀY)$/i.test(line) || upper.startsWith('DATE:') || upper.startsWith('NGÀY:')) {
      if (current && (current.date || current.subjectCode)) {
        results.push(current);
      }
      current = {
        id: `fap_card_${Date.now()}_${results.length}`,
        date: '',
        time: '',
        room: '',
        subjectCode: '',
        subjectName: '',
        examForm: 'Practical_Exam (PEA client)',
        examType: 'PE',
        publishDate: '',
        note: '',
        reminderEnabled: true,
        customReminderMinutes: null,
        notified: false,
      };
      lastKey = 'date';
      const val = line.replace(/^(DATE|NGÀY)[:\s]*/i, '').trim();
      if (val) current.date = val;
      continue;
    }

    if (current) {
      if (/^(TIME|THỜI GIAN|GIỜ)$/i.test(line) || upper.startsWith('TIME:') || upper.startsWith('THỜI GIAN:')) {
        lastKey = 'time';
        const val = line.replace(/^(TIME|THỜI GIAN|GIỜ)[:\s]*/i, '').trim();
        if (val) current.time = val;
      } else if (/^(ROOM|PHÒNG|PHÒNG THI)$/i.test(line) || upper.startsWith('ROOM:') || upper.startsWith('PHÒNG:')) {
        lastKey = 'room';
        const val = line.replace(/^(ROOM|PHÒNG|PHÒNG THI)[:\s]*/i, '').trim();
        if (val) current.room = val;
      } else if (/^(SUBJECT|MÔN|MÔN THI)$/i.test(line) || upper.startsWith('SUBJECT:') || upper.startsWith('MÔN:')) {
        lastKey = 'subject';
        const val = line.replace(/^(SUBJECT|MÔN|MÔN THI)[:\s]*/i, '').trim();
        if (val) {
          const sp = val.split(/\s*-\s*/);
          current.subjectCode = sp[0].trim();
          current.subjectName = sp.slice(1).join(' - ').trim() || val;
        }
      } else if (/^(EXAM FORMAT|HÌNH THỨC|HÌNH THỨC THI)$/i.test(line) || upper.startsWith('EXAM FORMAT:') || upper.startsWith('HÌNH THỨC:')) {
        lastKey = 'format';
        const val = line.replace(/^(EXAM FORMAT|HÌNH THỨC|HÌNH THỨC THI)[:\s]*/i, '').trim();
        if (val) current.examForm = val;
      } else if (/^(EXAM TYPE|LOẠI THI)$/i.test(line) || upper.startsWith('EXAM TYPE:') || upper.startsWith('LOẠI THI:')) {
        lastKey = 'type';
        const val = line.replace(/^(EXAM TYPE|LOẠI THI)[:\s]*/i, '').trim();
        if (val) current.examType = val;
      } else if (/^(GRADE PUBLICATION DATE|NGÀY CÔNG BỐ|NGÀY CÔNG BỐ ĐIỂM)$/i.test(line) || upper.startsWith('GRADE PUBLICATION DATE:') || upper.startsWith('NGÀY CÔNG BỐ:')) {
        lastKey = 'publishDate';
        const val = line.replace(/^(GRADE PUBLICATION DATE|NGÀY CÔNG BỐ|NGÀY CÔNG BỐ ĐIỂM)[:\s]*/i, '').trim();
        if (val) current.publishDate = val;
      } else if (/^(ATTENDANCE NOTE|GHI CHÚ ĐIỂM DANH|NOTE|GHI CHÚ)$/i.test(line)) {
        lastKey = 'note';
      } else {
        if (lastKey === 'date' && !current.date && /\d{2}\/\d{2}\/\d{4}/.test(line)) {
          current.date = line;
        } else if (lastKey === 'time' && !current.time) {
          current.time = line.replace(/\s+/g, '');
        } else if (lastKey === 'room' && !current.room) {
          current.room = line;
        } else if (lastKey === 'subject' && !current.subjectCode) {
          const sp = line.split(/\s*-\s*/);
          current.subjectCode = sp[0].trim();
          current.subjectName = sp.slice(1).join(' - ').trim() || line;
        } else if (lastKey === 'format' && !current.examForm) {
          current.examForm = line;
        } else if (lastKey === 'type' && !current.examType) {
          current.examType = line;
        } else if (lastKey === 'publishDate' && !current.publishDate && /\d{2}\/\d{2}\/\d{4}/.test(line)) {
          current.publishDate = line;
        }
      }
    }
  }

  if (current && (current.date || current.subjectCode)) {
    results.push(current);
  }

  // 3. Kiểm tra định dạng khối tuần tự (Dán trực tiếp từ FAP: Dòng Ngày -> Dòng Giờ -> Dòng Phòng -> Dòng Môn...)
  if (results.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})$/);
      if (dateMatch) {
        const nextLine = lines[i + 1] || '';
        const timeMatch = nextLine.match(/(\d{1,2}[h:]\d{2}\s*[\-–]\s*\d{1,2}[h:]\d{2})/i);
        if (timeMatch) {
          const date = dateMatch[1];
          const time = timeMatch[1].replace(/\s+/g, '');
          const room = lines[i + 2] || 'BE-212';
          const subRaw = lines[i + 3] || 'Môn thi';
          const format = lines[i + 4] || 'Practical_Exam';
          const type = lines[i + 5] || 'PE';
          const pubDateMatch = (lines[i + 6] || '').match(/\d{2}\/\d{2}\/\d{4}/);
          const publishDate = pubDateMatch ? pubDateMatch[0] : '';

          const sp = subRaw.split(/\s*-\s*/);
          const subjectCode = sp[0].trim();
          const subjectName = sp.slice(1).join(' - ').trim() || subRaw;

          results.push({
            id: `fap_real_${subjectCode}_${date.replace(/\D/g, '')}_${time.replace(/\D/g, '').slice(0, 4)}`,
            date,
            time,
            room,
            subjectCode,
            subjectName,
            examForm: format,
            examType: type,
            publishDate,
            note: '',
            reminderEnabled: true,
            customReminderMinutes: null,
            notified: false,
          });
          i += 6;
        }
      }
    }
  }

  return results;
}

/**
 * Bóc tách thông tin sinh viên từ văn bản copy từ trang FAP
 */
export function parseFapStudentInfo(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  let studentName = '';
  let studentId = '';
  let campus = 'Cơ sở Hà Nội (HN)';

  const campusMatch = rawInput.match(/Cơ sở\s+([^\n\r\(\)]+)\s*\(([A-Z]{2,3})\)/i);
  if (campusMatch) campus = campusMatch[0].trim();

  const userBlockMatch = rawInput.match(/\[([A-Z]{2})([^\[\]\d]+)([A-Z]{2}\d{5,7})\]/i);
  if (userBlockMatch) {
    studentName = userBlockMatch[2].trim();
    studentId = userBlockMatch[3].trim().toUpperCase();
  } else {
    const rollMatch = rawInput.match(/\b([A-Z]{2}\d{5,7})\b/i);
    if (rollMatch) studentId = rollMatch[1].toUpperCase();
    const nameMatch = rawInput.match(/THÔNG TIN SINH VIÊN[\s\n]+([^\n\r]+)/i);
    if (nameMatch) studentName = nameMatch[1].trim();
  }

  if (!studentId && !studentName) return null;

  return {
    name: studentName || 'Sinh Viên FPT',
    studentId: studentId || 'HE180000',
    program: 'BIT_SE_19C_NJ',
    campus,
    email: `${(studentId || 'he180000').toLowerCase()}@fpt.edu.vn`,
    status: 'HD',
    cohort: '19',
  };
}

/**
 * Script JS tự động chèn vào WebView trên trang fap.fpt.edu.vn/ExamSchedule để đọc bảng lịch thi
 */
export const FAP_WEBVIEW_EXTRACTOR_JS = `
(function() {
  try {
    var rows = document.querySelectorAll('table tbody tr, table tr');
    var extracted = [];
    rows.forEach(function(tr) {
      var cells = tr.querySelectorAll('td');
      if (cells && cells.length >= 4) {
        var rowText = Array.from(cells).map(function(td) { return (td.innerText || '').trim(); }).join('\\t');
        if (/\\d{2}\\/\\d{2}\\/\\d{4}/.test(rowText)) {
          extracted.push(rowText);
        }
      }
    });

    var studentNameEl = document.querySelector('.user-name, .profile-name, h4, h5');
    var payload = {
      type: 'FAP_EXAM_DATA',
      url: window.location.href,
      rawRows: extracted.join('\\n'),
      count: extracted.length,
      pageTitle: document.title
    };
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  } catch (e) {}
  true;
})();
`;

/**
 * Phát thông báo nhắc nhở lịch thi (hỗ trợ cả Mobile Push Notification, Web Notification & In-App Alert)
 */
export async function triggerExamNotification(exam, minutesBefore) {
  const title = `🔔 Nhắc lịch thi FAP: ${exam.subjectCode} (${exam.examType})`;
  const body = `Môn ${exam.subjectCode} - ${exam.subjectName} sẽ thi lúc ${exam.time} ngày ${exam.date} tại phòng ${exam.room} (nhắc trước ${minutesBefore} phút).`;

  // 1. Hiển thị Alert trong ứng dụng
  Alert.alert(title, body, [{ text: 'Đã chuẩn bị sẵn sàng!', style: 'default' }]);

  // 2. Nếu chạy trên Web và trình duyệt hỗ trợ Notification API
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (window.Notification.permission === 'granted') {
          new window.Notification(title, { body });
        } else if (window.Notification.permission !== 'denied') {
          const perm = await window.Notification.requestPermission();
          if (perm === 'granted') {
            new window.Notification(title, { body });
          }
        }
      }
    } catch {}
    return;
  }

  // 3. Trên Mobile (iOS / Android): Gửi Local Push Notification qua expo-notifications
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
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Phát ngay lập tức
      });
    }
  } catch (err) {
    console.warn('[FAP Reminder] Không thể phát Push Notification:', err?.message);
  }
}

