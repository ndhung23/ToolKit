// src/screens/tools/fap/FapRealWebViewModal.js
// Modal WebView kết nối Cổng FAP thật (fap.fpt.edu.vn) cho cả Mobile Native và Web
// Chuẩn URL: https://fap.fpt.edu.vn/ExamSchedule & https://fap.fpt.edu.vn/WeeklyTimetable

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSafeTop } from '../../components/ui';

// Nạp an toàn WebView từ react-native-webview trên Mobile (tránh lỗi trên Web)
let NativeWebView = null;
if (Platform.OS !== 'web') {
  try {
    NativeWebView = require('react-native-webview').WebView;
  } catch (e) {
    console.warn('[FapWebView] Native WebView not available:', e);
  }
}

// Script bóc tách thông minh chạy trực tiếp trong DOM thật của FAP
// Bóc tách Lịch thi (/ExamSchedule) và Thời khóa biểu tuần (/WeeklyTimetable)
const FAP_SCRAPER_INJECTED_JS = `
  function cleanFapText(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw
      .replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, '')
      .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, '')
      .replace(/<\\/tr>/gi, '\\n')
      .replace(/<\\/td>/gi, '\\t')
      .replace(/<\\/th>/gi, '\\t')
      .replace(/<\\/div>/gi, '\\n')
      .replace(/<\\/p>/gi, '\\n')
      .replace(/<br\\s*[\\/]?>/gi, '\\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&');
  }

  function parseSubject(subRaw) {
    if (!subRaw) return { code: 'MÔN THI', name: 'Môn thi FPT' };
    var clean = subRaw.replace(/^(MÔN\\s*THI|MÔN|SUBJECT)[:\\s]*/i, '').trim();
    var parts = clean.split(/\\s*[-–]\\s*/);
    var code = parts[0].trim().toUpperCase();
    var name = parts.slice(1).join(' - ').trim() || clean;
    return { code: code, name: name };
  }

  // 1. Bóc tách Lịch thi từ https://fap.fpt.edu.vn/ExamSchedule
  function parseExamsFromHtmlOrDOM() {
    var results = [];

    // Cách 1: Quét trực tiếp Table DOM (Desktop / Responsive Table FAP)
    var table = document.querySelector('table');
    if (table) {
      var rows = table.querySelectorAll('tbody tr');
      if (rows.length === 0) rows = table.querySelectorAll('tr');

      for (var i = 0; i < rows.length; i++) {
        var cells = rows[i].querySelectorAll('td');
        if (cells.length < 5) continue;

        var rowText = Array.from(cells).map(function(c) { return (c.innerText || '').trim(); });
        var dateIdx = -1;
        var timeIdx = -1;
        for (var j = 0; j < rowText.length; j++) {
          if (/\\d{2}\\/\\d{2}\\/\\d{4}/.test(rowText[j]) && dateIdx === -1) dateIdx = j;
          if (/\\d{1,2}[h:]\\d{2}\\s*[-–]\\s*\\d{1,2}[h:]\\d{2}/i.test(rowText[j]) && timeIdx === -1) timeIdx = j;
        }

        if (dateIdx !== -1 && timeIdx !== -1) {
          var dateVal = rowText[dateIdx];
          var timeVal = rowText[timeIdx].replace(/\\s+/g, '');
          var roomVal = rowText[timeIdx + 1] || '-';
          var subVal = rowText[timeIdx + 2] || '';
          var sInfo = parseSubject(subVal);
          var formatVal = rowText[timeIdx + 3] || 'Practical_Exam';
          var typeVal = rowText[timeIdx + 4] || 'PE';
          var pubM = (rowText[timeIdx + 5] || '').match(/\\d{2}\\/\\d{2}\\/\\d{4}/);
          var pubVal = pubM ? pubM[0] : '';

          results.push({
            id: 'fap_exam_' + sInfo.code + '_' + dateVal.replace(/\\D/g, '') + '_' + timeVal.replace(/\\D/g, '').slice(0, 4) + '_' + results.length,
            date: dateVal,
            time: timeVal,
            room: roomVal,
            subjectCode: sInfo.code,
            subjectName: sInfo.name,
            examForm: formatVal,
            examType: typeVal,
            publishDate: pubVal,
            note: '',
            reminderEnabled: true,
            customReminderMinutes: null,
            notified: false
          });
        }
      }
    }

    if (results.length > 0) return results;

    // Cách 2: Quét dạng Thẻ Card Mobile FAP
    var text = cleanFapText(document.documentElement ? document.documentElement.outerHTML : '');
    var lines = text.split(/\\r?\\n/).map(function(l) { return l.trim(); }).filter(Boolean);
    var currentCard = null;
    var currentLabel = null;

    for (var k = 0; k < lines.length; k++) {
      var lk = lines[k];
      var uk = lk.toUpperCase();

      if (/^(DATE|NGÀY)$/i.test(lk) || uk.indexOf('DATE:') === 0 || uk.indexOf('NGÀY:') === 0) {
        if (currentCard && currentCard.date && (currentCard.subjectCode || currentCard.time)) {
          results.push(currentCard);
        }
        currentCard = {
          date: '',
          time: '',
          room: '',
          subjectCode: '',
          subjectName: '',
          examForm: 'Practical_Exam',
          examType: 'PE',
          publishDate: '',
          note: '',
          reminderEnabled: true,
          customReminderMinutes: null,
          notified: false
        };
        currentLabel = 'date';
        var inDate = lk.replace(/^(DATE|NGÀY)[:\\s]*/i, '').trim();
        if (inDate && /\\d{2}\\/\\d{2}\\/\\d{4}/.test(inDate)) currentCard.date = inDate;
        continue;
      }

      if (currentCard) {
        if (/^(TIME|THỜI GIAN|GIỜ)$/i.test(lk) || uk.indexOf('TIME:') === 0 || uk.indexOf('THỜI GIAN:') === 0) {
          currentLabel = 'time';
          var inTime = lk.replace(/^(TIME|THỜI GIAN|GIỜ)[:\\s]*/i, '').trim();
          if (inTime && /\\d{1,2}[h:]\\d{2}/i.test(inTime)) currentCard.time = inTime.replace(/\\s+/g, '');
        } else if (/^(ROOM|PHÒNG|PHÒNG THI)$/i.test(lk) || uk.indexOf('ROOM:') === 0 || uk.indexOf('PHÒNG:') === 0) {
          currentLabel = 'room';
          var inRoom = lk.replace(/^(ROOM|PHÒNG|PHÒNG THI)[:\\s]*/i, '').trim();
          if (inRoom) currentCard.room = inRoom;
        } else if (/^(MÔN\\s*THI|MÔN|SUBJECT)$/i.test(lk) || uk.indexOf('MÔN THI:') === 0 || uk.indexOf('MÔN:') === 0 || uk.indexOf('SUBJECT:') === 0) {
          currentLabel = 'subject';
          var inSub = lk.replace(/^(MÔN\\s*THI|MÔN|SUBJECT)[:\\s]*/i, '').trim();
          if (inSub && inSub !== lk) {
            var subObj = parseSubject(inSub);
            currentCard.subjectCode = subObj.code;
            currentCard.subjectName = subObj.name;
          }
        } else if (/^(HÌNH\\s*THỨC\\s*THI|HÌNH\\s*THỨC|EXAM\\s*FORMAT)$/i.test(lk) || uk.indexOf('HÌNH THỨC:') === 0 || uk.indexOf('EXAM FORMAT:') === 0) {
          currentLabel = 'format';
          var inFmt = lk.replace(/^(HÌNH\\s*THỨC\\s*THI|HÌNH\\s*THỨC|EXAM\\s*FORMAT)[:\\s]*/i, '').trim();
          if (inFmt && inFmt !== lk) currentCard.examForm = inFmt;
        } else if (/^(LOẠI\\s*THI|EXAM\\s*TYPE)$/i.test(lk) || uk.indexOf('LOẠI THI:') === 0 || uk.indexOf('EXAM TYPE:') === 0) {
          currentLabel = 'type';
          var inType = lk.replace(/^(LOẠI\\s*THI|EXAM\\s*TYPE)[:\\s]*/i, '').trim();
          if (inType && inType !== lk) currentCard.examType = inType;
        } else if (/^(NGÀY\\s*CÔNG\\s*BỐ\\s*ĐIỂM|NGÀY\\s*CÔNG\\s*BỐ)$/i.test(lk) || uk.indexOf('NGÀY CÔNG BỐ:') === 0) {
          currentLabel = 'publishDate';
          var inPub = lk.replace(/^(NGÀY\\s*CÔNG\\s*BỐ\\s*ĐIỂM|NGÀY\\s*CÔNG\\s*BỐ)[:\\s]*/i, '').trim();
          if (inPub && /\\d{2}\\/\\d{2}\\/\\d{4}/.test(inPub)) currentCard.publishDate = inPub;
        } else {
          if (currentLabel === 'date' && !currentCard.date) {
            var dm = lk.match(/\\d{2}\\/\\d{2}\\/\\d{4}/);
            if (dm) currentCard.date = dm[0];
          } else if (currentLabel === 'time' && !currentCard.time) {
            var tm = lk.match(/\\d{1,2}[h:]\\d{2}\\s*[-–]\\s*\\d{1,2}[h:]\\d{2}/i);
            if (tm) currentCard.time = tm[0].replace(/\\s+/g, '');
          } else if (currentLabel === 'room' && !currentCard.room) {
            currentCard.room = lk;
          } else if (currentLabel === 'subject' && !currentCard.subjectCode) {
            var subO = parseSubject(lk);
            currentCard.subjectCode = subO.code;
            currentCard.subjectName = subO.name;
          } else if (currentLabel === 'format' && !currentCard.examForm) {
            currentCard.examForm = lk;
          } else if (currentLabel === 'type' && !currentCard.examType) {
            currentCard.examType = lk;
          } else if (currentLabel === 'publishDate' && !currentCard.publishDate) {
            var pm = lk.match(/\\d{2}\\/\\d{2}\\/\\d{4}/);
            if (pm) currentCard.publishDate = pm[0];
          }
        }
      }
    }

    if (currentCard && currentCard.date && (currentCard.subjectCode || currentCard.time)) {
      results.push(currentCard);
    }

    return results.map(function(item, idx) {
      return {
        id: 'fap_card_' + (item.subjectCode || 'sub') + '_' + (item.date ? item.date.replace(/\\D/g, '') : 'd') + '_' + idx,
        date: item.date,
        time: item.time,
        room: item.room || 'BE-212',
        subjectCode: item.subjectCode || 'MÔN THI',
        subjectName: item.subjectName || item.subjectCode,
        examForm: item.examForm || 'Practical_Exam',
        examType: item.examType || 'PE',
        publishDate: item.publishDate || '',
        note: item.note || '',
        reminderEnabled: true,
        customReminderMinutes: null,
        notified: false
      };
    });
  }

  // 2. Bóc tách Thời khóa biểu tuần từ https://fap.fpt.edu.vn/WeeklyTimetable
  function parseWeeklyTimetableFromDOM() {
    var table = document.querySelector('table');
    if (!table) return [];

    var headers = [];
    var ths = table.querySelectorAll('thead th, tr:first-child th, tr:first-child td');
    for (var h = 0; h < ths.length; h++) {
      var hText = (ths[h].innerText || ths[h].textContent || '').trim();
      headers.push(hText);
    }

    var slots = [];
    var rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) rows = table.querySelectorAll('tr');

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var cells = row.querySelectorAll('td');
      if (cells.length < 2) continue;

      var slotText = (cells[0].innerText || cells[0].textContent || '').trim();
      var slotMatch = slotText.match(/(\\d+)/);
      var slotNum = slotMatch ? parseInt(slotMatch[1], 10) : (r + 1);

      for (var c = 1; c < cells.length; c++) {
        var cell = cells[c];
        var cellText = (cell.innerText || cell.textContent || '').trim();
        if (!cellText || cellText === '-' || cellText === '') continue;

        var subMatch = cellText.match(/\\b([A-Z]{3}\\d{3}[a-z]?)\\b/i);
        if (!subMatch) continue;
        var subjectCode = subMatch[1].toUpperCase();

        var status = 'Not yet';
        var lowerCell = cellText.toLowerCase();
        if (lowerCell.indexOf('có mặt') !== -1 || lowerCell.indexOf('present') !== -1) {
          status = 'Present';
        } else if (lowerCell.indexOf('vắng') !== -1 || lowerCell.indexOf('absent') !== -1) {
          status = 'Absent';
        }

        var timeMatch = cellText.match(/(\\d{1,2}[h:]\\d{2}\\s*[-–]\\s*\\d{1,2}[h:]\\d{2})/i);
        var timeStr = timeMatch ? timeMatch[1].replace(/\\s+/g, '') : '';
        if (!timeStr) {
          if (slotNum === 1) timeStr = '07h30-09h50';
          else if (slotNum === 2) timeStr = '10h00-12h20';
          else if (slotNum === 3) timeStr = '12h50-15h10';
          else if (slotNum === 4) timeStr = '15h20-17h40';
          else if (slotNum === 5) timeStr = '17h50-20h10';
          else if (slotNum === 6) timeStr = '20h20-22h40';
        }

        var roomMatch = cellText.match(/\\b([A-Z]{2,3}[-_][A-Z0-9]+)\\b/);
        var room = roomMatch ? roomMatch[1] : 'BE-212';

        var lecturerMatch = cellText.match(/\\b([a-zA-Z]{3,10}\\d{0,3})\\b$/m);
        var lecturer = lecturerMatch ? lecturerMatch[1] : '';

        var dayHeader = headers[c] || ('Thứ ' + (c + 1));
        var dateMatch = dayHeader.match(/(\\d{1,2}\\/\\d{1,2})/);
        var dateStr = dateMatch ? dateMatch[1] : '';

        var alertTime = '10:00';
        if (slotNum === 1) alertTime = '10:00';
        else if (slotNum === 2) alertTime = '12:30';
        else if (slotNum === 3) alertTime = '15:20';
        else if (slotNum === 4) alertTime = '17:50';
        else if (slotNum === 5) alertTime = '20:20';
        else if (slotNum === 6) alertTime = '22:50';

        slots.push({
          id: 'slot_' + slotNum + '_' + subjectCode + '_' + c + '_' + slots.length,
          slot: slotNum,
          dayIndex: c + 1,
          dayName: dayHeader,
          date: dateStr,
          subjectCode: subjectCode,
          subjectName: subjectCode,
          room: room,
          time: timeStr,
          alertTime: alertTime,
          status: status,
          lecturer: lecturer,
          notified: false
        });
      }
    }

    return slots;
  }

  // Chạy bóc tách dữ liệu khi đã ở đúng trang lịch học/lịch thi
  function doAutoOrManualScrape(isManual) {
    try {
      var currentUrl = window.location.href || '';
      var pathname = (window.location.pathname || '').toLowerCase();

      // KIỂM TRA ĐĂNG NHẬP: Tuyệt đối không cào và không chuyển trang khi đang ở trang xác thực/đăng nhập
      var isAuth =
        pathname.indexOf('/auth/login') !== -1 ||
        currentUrl.indexOf('/auth/login') !== -1 ||
        currentUrl.indexOf('accounts.google.com') !== -1 ||
        currentUrl.indexOf('feid.fpt.edu.vn') !== -1 ||
        currentUrl.indexOf('challenges.cloudflare') !== -1;

      if (isAuth) {
        return;
      }

      var fullText = document.body ? (document.body.innerText || document.body.textContent || '') : '';

      // 1. Tìm thông tin sinh viên thật từ trang
      var rollNumber = '';
      var rollMatch = fullText.match(/\\b([A-Z]{2}\\d{5,7})\\b/i);
      if (rollMatch) rollNumber = rollMatch[1].toUpperCase();

      var studentName = '';
      if (rollNumber) {
        var namePattern = '([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,4})\\s*' + rollNumber;
        var mName = fullText.match(new RegExp(namePattern, 'i'));
        if (mName && mName[1]) studentName = mName[1].trim();
      }

      if (!studentName || studentName === 'NH' || studentName.length <= 3) {
        var nameMatch = fullText.match(/TH\\u00d4NG TIN SINH VI\\u00caN[\\s\\n]+([^\\n\\r]+)/i);
        if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 3) {
          studentName = nameMatch[1].trim();
        }
      }

      if (!studentName || studentName === 'NH' || studentName.length <= 3) {
        var headerUserMatch = fullText.match(/\\[([A-Z]{2})([^\\d\\[\\]]+)([A-Z]{2}\\d{5,7})\\]/i);
        if (headerUserMatch && headerUserMatch[2].trim().length > 3) {
          studentName = headerUserMatch[2].trim();
        }
      }

      if (!studentName || studentName === 'NH' || studentName.length <= 3) {
        studentName = 'Nguyễn Duy Hưng';
      }

      var program = '';
      var progMatch = fullText.match(/M\\u00e3 ch\\u01b0\\u01a1ng tr\\u00ecnh[:\\s\\n]+([A-Z0-9_]+)/i);
      if (progMatch) program = progMatch[1].trim();

      var userObj = {
        name: studentName,
        studentId: rollNumber || 'HE190591',
        program: program || 'BIT_SE_19C_NJ',
        campus: 'Cơ sở Hà Nội (HN)',
        email: (rollNumber ? rollNumber.toLowerCase() : 'he190591') + '@fpt.edu.vn'
      };

      // TRƯỜNG HỢP 1: Đang ở https://fap.fpt.edu.vn/ExamSchedule -> Cào Lịch thi
      if (pathname.indexOf('examschedule') !== -1) {
        var exams = parseExamsFromHtmlOrDOM();
        if (exams.length > 0 && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FAP_EXAM_SCHEDULE_SYNCED',
            user: userObj,
            exams: exams
          }));
          return;
        }
      }

      // TRƯỜNG HỢP 2: Đang ở https://fap.fpt.edu.vn/WeeklyTimetable -> Cào Thời khóa biểu & Điểm danh
      if (pathname.indexOf('weeklytimetable') !== -1) {
        var slots = parseWeeklyTimetableFromDOM();
        if (slots.length > 0 && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FAP_WEEKLY_TIMETABLE_SYNCED',
            user: userObj,
            slots: slots
          }));
          return;
        }
      }
    } catch(e) {}
  }
`;

export default function FapRealWebViewModal({
  visible,
  onClose,
  colors,
  onSyncSuccess,
  onSyncTimetableSuccess,
  onOpenPasteModal,
  initialTarget = 'exams', // 'exams' | 'timetable'
}) {
  const safeTop = useSafeTop();
  const insets = useSafeAreaInsets();
  const initialUri =
    initialTarget === 'timetable'
      ? 'https://fap.fpt.edu.vn/WeeklyTimetable'
      : 'https://fap.fpt.edu.vn/ExamSchedule';

  const [currentUrl, setCurrentUrl] = useState(initialUri);
  const [loading, setLoading] = useState(false);
  const webViewRef = useRef(null);

  useEffect(() => {
    if (visible) {
      const targetUri =
        initialTarget === 'timetable'
          ? 'https://fap.fpt.edu.vn/WeeklyTimetable'
          : 'https://fap.fpt.edu.vn/ExamSchedule';
      setCurrentUrl(targetUri);
    }
  }, [visible, initialTarget]);

  // Xử lý message nhận được từ WebView
  const handleNativeMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'FAP_EXAM_SCHEDULE_SYNCED') {
        if (data.exams && data.exams.length > 0) {
          onSyncSuccess(data.user, data.exams);
          Alert.alert(
            'Đồng bộ Lịch thi FAP thành công! 🎉',
            `Đã lấy được ${data.exams.length} môn thi từ fap.fpt.edu.vn/ExamSchedule của sinh viên ${data.user?.name || ''} (${data.user?.studentId || ''}):\n${data.exams.map((e) => `• ${e.subjectCode} (${e.date} lúc ${e.time})`).join('\n')}`,
            [{ text: 'Xem lịch thi', style: 'default' }]
          );
          onClose();
        }
      } else if (data.type === 'FAP_WEEKLY_TIMETABLE_SYNCED') {
        if (data.slots && data.slots.length > 0) {
          if (onSyncTimetableSuccess) {
            onSyncTimetableSuccess(data.user, data.slots);
          }
          const absentSlots = data.slots.filter((s) => s.status === 'Absent');
          Alert.alert(
            'Đồng bộ Thời khóa biểu FAP thành công! ⏰',
            `Đã lấy được ${data.slots.length} ca học trong tuần từ fap.fpt.edu.vn/WeeklyTimetable.${absentSlots.length > 0 ? `\nPhát hiện ${absentSlots.length} ca bị vắng mặt (Absent) đã kích hoạt chuông cảnh báo!` : ''}`,
            [{ text: 'Xem thời khóa biểu', style: 'default' }]
          );
          onClose();
        }
      }
    } catch (e) {
      console.warn('[FapWebView] Parse message error:', e);
    }
  };

  // Điều hướng WebView sang Lịch thi (/ExamSchedule)
  const handleNavExamSchedule = () => {
    if (webViewRef.current) {
      setLoading(true);
      webViewRef.current.injectJavaScript(`
        window.location.href = 'https://fap.fpt.edu.vn/ExamSchedule';
        true;
      `);
      setTimeout(() => setLoading(false), 2000);
    }
  };

  // Điều hướng WebView sang Thời khóa biểu (/WeeklyTimetable)
  const handleNavWeeklyTimetable = () => {
    if (webViewRef.current) {
      setLoading(true);
      webViewRef.current.injectJavaScript(`
        window.location.href = 'https://fap.fpt.edu.vn/WeeklyTimetable';
        true;
      `);
      setTimeout(() => setLoading(false), 2000);
    }
  };

  const handleOpenFapWeb = () => {
    Linking.openURL(currentUrl || 'https://fap.fpt.edu.vn/ExamSchedule');
  };

  // 1-Chạm: Tự động kích hoạt Đăng nhập Google FPT
  const handleAutoClickGoogle = () => {
    if (webViewRef.current) {
      setLoading(true);
      webViewRef.current.injectJavaScript(`
        (function() {
          var btns = document.querySelectorAll('button, a, input[type="submit"]');
          for (var i = 0; i < btns.length; i++) {
            var t = (btns[i].innerText || btns[i].value || '').toLowerCase();
            if (t.indexOf('google') !== -1) {
              btns[i].click();
              return true;
            }
          }
          var gBtn = document.querySelector('button[value="Google"], a[href*="Google"], .btn-google');
          if (gBtn) gBtn.click();
          true;
        })();
      `);
      setTimeout(() => setLoading(false), 2000);
    }
  };

  // 1-Chạm: Tự động kích hoạt Đăng nhập FeID
  const handleAutoClickFeid = () => {
    if (webViewRef.current) {
      setLoading(true);
      webViewRef.current.injectJavaScript(`
        (function() {
          var btns = document.querySelectorAll('button, a, input[type="submit"]');
          for (var i = 0; i < btns.length; i++) {
            var t = (btns[i].innerText || btns[i].value || '').toLowerCase();
            if (t.indexOf('feid') !== -1) {
              btns[i].click();
              return true;
            }
          }
          var fBtn = document.querySelector('button[value="FeID"], a[href*="FeID"], .btn-feid');
          if (fBtn) fBtn.click();
          true;
        })();
      `);
      setTimeout(() => setLoading(false), 2000);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header - NÉ TAI THỎ / DYNAMIC ISLAND */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.cardBorder,
              paddingTop: safeTop + 6,
            },
          ]}
        >
          <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              Cổng Đào Tạo FAP — FPT University
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.sub }]} numberOfLines={1}>
              {currentUrl}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable onPress={handleOpenFapWeb} style={styles.headerBtn} hitSlop={6} title="Safari ngoài">
              <Ionicons name="compass-outline" size={21} color="#3B82F6" />
            </Pressable>

            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web' && webViewRef.current) {
                  webViewRef.current.reload();
                } else {
                  handleOpenFapWeb();
                }
              }}
              style={styles.headerBtn}
              hitSlop={6}
            >
              <Ionicons name="reload" size={20} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {loading && (
          <View style={[styles.progressBar, { backgroundColor: colors.primary }]}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}

        {/* WebView Native trên iOS / Android */}
        {Platform.OS !== 'web' && NativeWebView ? (
          <View style={{ flex: 1 }}>
            <NativeWebView
              ref={webViewRef}
              source={{ uri: initialUri }}
              originWhitelist={['*']}
              userAgent={
                Platform.OS === 'ios'
                  ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1'
                  : 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
              }
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              useSharedProcessPool={true}
              saveFormData={true}
              saveFormDataDisabled={false}
              cacheEnabled={true}
              cacheMode="LOAD_DEFAULT"
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              fraudulentWebsiteWarningEnabled={false}
              incognito={false}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={(syntheticEvent) => {
                setLoading(false);
                const url = (syntheticEvent?.nativeEvent?.url || currentUrl || '').toLowerCase();
                const isAuthOrChallenge =
                  url.includes('/auth/login') ||
                  url.includes('accounts.google') ||
                  url.includes('feid.fpt.edu.vn') ||
                  url.includes('challenges.cloudflare');

                // CHỈ TỰ ĐỘNG CÀO KHI ĐÃ ĐĂNG NHẬP THÀNH CÔNG VÀ ĐANG Ở ĐÚNG TRANG LỊCH THI HOẶC TKB
                if (url.includes('fap.fpt.edu.vn') && !isAuthOrChallenge) {
                  const isRealExamPage = url.includes('/examschedule');
                  const isRealTimetablePage = url.includes('/weeklytimetable');
                  if (isRealExamPage || isRealTimetablePage) {
                    setTimeout(() => {
                      webViewRef.current?.injectJavaScript(`
                        (function() {
                          ${FAP_SCRAPER_INJECTED_JS}
                          doAutoOrManualScrape(false);
                          true;
                        })();
                      `);
                    }, 600);
                  }
                }
              }}
              onNavigationStateChange={(navState) => {
                setCurrentUrl(navState.url);
              }}
              onMessage={handleNativeMessage}
              style={styles.webview}
            />

            {/* Thanh điều khiển chọn cào Lịch thi hoặc Thời khóa biểu */}
            <View
              style={[
                styles.bottomBar,
                {
                  backgroundColor: colors.card,
                  borderTopColor: colors.cardBorder,
                  paddingBottom: Math.max(insets.bottom, 12),
                },
              ]}
            >
              {currentUrl.toLowerCase().includes('/auth/login') ? (
                <>
                  <Pressable
                    onPress={handleAutoClickGoogle}
                    style={[styles.tabNavBtn, { backgroundColor: '#EA4335' }]}
                  >
                    <Ionicons name="logo-google" size={15} color="#FFFFFF" />
                    <Text style={[styles.tabNavBtnText, { color: '#FFFFFF' }]}>
                      1-Chạm Google
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleAutoClickFeid}
                    style={[styles.tabNavBtn, { backgroundColor: '#4F46E5' }]}
                  >
                    <Ionicons name="key" size={15} color="#FFFFFF" />
                    <Text style={[styles.tabNavBtnText, { color: '#FFFFFF' }]}>
                      1-Chạm FeID
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={handleNavExamSchedule}
                    style={[
                      styles.tabNavBtn,
                      currentUrl.toLowerCase().includes('examschedule')
                        ? { backgroundColor: colors.primary }
                        : { borderColor: colors.primary, borderWidth: 1 },
                    ]}
                  >
                    <Ionicons
                      name="calendar"
                      size={15}
                      color={currentUrl.toLowerCase().includes('examschedule') ? '#121214' : colors.primary}
                    />
                    <Text
                      style={[
                        styles.tabNavBtnText,
                        { color: currentUrl.toLowerCase().includes('examschedule') ? '#121214' : colors.primary },
                      ]}
                    >
                      📅 Cào Lịch thi
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleNavWeeklyTimetable}
                    style={[
                      styles.tabNavBtn,
                      currentUrl.toLowerCase().includes('weeklytimetable')
                        ? { backgroundColor: '#10B981' }
                        : { borderColor: '#10B981', borderWidth: 1 },
                    ]}
                  >
                    <Ionicons
                      name="time"
                      size={15}
                      color={currentUrl.toLowerCase().includes('weeklytimetable') ? '#FFFFFF' : '#10B981'}
                    />
                    <Text
                      style={[
                        styles.tabNavBtnText,
                        { color: currentUrl.toLowerCase().includes('weeklytimetable') ? '#FFFFFF' : '#10B981' },
                      ]}
                    >
                      ⏰ Cào TKB & Điểm danh
                    </Text>
                  </Pressable>
                </>
              )}

              <Pressable
                onPress={() => {
                  onClose();
                  onOpenPasteModal?.();
                }}
                style={[styles.pasteFallbackBtn, { borderColor: colors.cardBorder }]}
              >
                <Ionicons name="clipboard-outline" size={15} color={colors.sub} />
                <Text style={[styles.pasteFallbackText, { color: colors.sub }]}>Dán tay</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.webSyncContainer}>
            <View style={[styles.webSyncCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.badgeRow}>
                <Ionicons name="phone-portrait-outline" size={20} color="#3B82F6" />
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
                  Đồng bộ FAP Chuẩn Thực Tế
                </Text>
              </View>

              <Text style={[styles.webSyncTitle, { color: colors.text }]}>
                URL Chuẩn Hệ Thống FAP
              </Text>

              <View style={[styles.infoBannerBox, { backgroundColor: 'rgba(59, 130, 246, 0.08)', borderColor: '#3B82F6' }]}>
                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>
                  • <Text style={{ fontWeight: '800' }}>Lịch thi:</Text> https://fap.fpt.edu.vn/ExamSchedule{'\n'}
                  • <Text style={{ fontWeight: '800' }}>Thời khóa biểu:</Text> https://fap.fpt.edu.vn/WeeklyTimetable
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 8 }}>
                <Pressable
                  onPress={handleOpenFapWeb}
                  style={[styles.actionButton, { backgroundColor: '#1E40AF' }]}
                >
                  <Ionicons name="open-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Mở fap.fpt.edu.vn/ExamSchedule</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    onClose();
                    onOpenPasteModal?.();
                  }}
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                >
                  <Ionicons name="clipboard-outline" size={17} color="#121214" />
                  <Text style={[styles.actionButtonText, { color: '#121214' }]}>
                    Dán lịch thi / TKB từ Web FAP
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 13.5, fontWeight: '800' },
  headerSubtitle: { fontSize: 11, marginTop: 1 },
  progressBar: { height: 2, alignItems: 'center', justifyContent: 'center' },
  webview: { flex: 1 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  tabNavBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    borderRadius: 12,
  },
  tabNavBtnText: {
    fontWeight: '900',
    fontSize: 12,
  },
  pasteFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  pasteFallbackText: {
    fontWeight: '800',
    fontSize: 12,
  },
  webSyncContainer: { flex: 1, padding: 18, justifyContent: 'center', alignItems: 'center' },
  webSyncCard: { maxWidth: 520, width: '100%', borderRadius: 20, borderWidth: 1, padding: 22, gap: 14 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  webSyncTitle: { fontSize: 17, fontWeight: '900', lineHeight: 22 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 },
  infoBannerBox: { padding: 12, borderRadius: 12, borderWidth: 1 },
});
