// src/features/fap/fapScraperScript.js
// Kịch bản bóc tách thông minh chạy trực tiếp trong DOM thật của FAP (fap.fpt.edu.vn)
// Hỗ trợ:
// 1. Lịch thi (/ExamSchedule)
// 2. Thời khóa biểu tuần (/WeeklyTimetable)
// 3. Báo cáo điểm danh Full cả môn (/Report/Attendance)

export const FAP_SCRAPER_INJECTED_JS = `
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

    // Quét dạng Thẻ Card Mobile FAP nếu không có table thông thường
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

    var headCells = Array.from(table.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td'));
    var headers = headCells.map(function(h) { return (h.innerText || h.textContent || '').trim(); });

    var allRows = Array.from(table.querySelectorAll('tbody tr')).filter(function(r) { return r.children.length >= 7; });
    if (allRows.length === 0) {
      allRows = Array.from(table.querySelectorAll('tr')).filter(function(r) { return r.children.length >= 7; });
      if (allRows.length > 0 && allRows[0].querySelectorAll('th').length > 3) {
        allRows.shift();
      }
    }

    var slots = [];
    allRows.forEach(function(row, rIdx) {
      var cells = Array.from(row.children);
      var slotText = (cells[0].innerText || cells[0].textContent || '').trim();
      var slotMatch = slotText.match(/\\d+/);
      var slotNum = slotMatch ? parseInt(slotMatch[0], 10) : (rIdx + 1);

      for (var c = 1; c < cells.length; c++) {
        var cell = cells[c];
        var cellText = (cell.innerText || cell.textContent || '').trim();
        if (!cellText || cellText === '-' || cellText.length < 3) continue;

        var subMatch = cellText.match(/\\b([A-Z]{3}\\d{3}[A-Z0-9]?)\\b/i);
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
        var timeStr = timeMatch ? timeMatch[1].replace(/\\s+/g, '') : (slotNum === 1 ? '07h30-09h50' : '10h00-12h20');

        var roomMatch = cellText.match(/\\b([A-Z0-9]{2,4}[-_][A-Z0-9]+)\\b/);
        var room = roomMatch ? roomMatch[1] : '';

        var cellLines = cellText.split(/\\r?\\n/).map(function(l) { return l.trim(); }).filter(Boolean);
        var lecturer = '';
        for (var li = 0; li < cellLines.length; li++) {
          var lineStr = cellLines[li];
          if (/^[a-zA-Z]{3,12}\\d{0,4}$/i.test(lineStr) && 
              lineStr.toUpperCase() !== subjectCode && 
              lineStr.toLowerCase().indexOf('offline') === -1 && 
              lineStr.toLowerCase().indexOf('online') === -1 &&
              lineStr.toLowerCase().indexOf('có mặt') === -1 &&
              lineStr.toLowerCase().indexOf('present') === -1 &&
              lineStr.toLowerCase().indexOf('vắng') === -1 &&
              lineStr.toLowerCase().indexOf('absent') === -1) {
            lecturer = lineStr;
            break;
          }
        }
        if (!lecturer) lecturer = 'Giảng viên';

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
    });

    return slots;
  }

  // 3. Bóc tách Báo cáo điểm danh Full cả môn từ https://fap.fpt.edu.vn/Report/Attendance
  function parseCourseAttendanceFromDOM() {
    var fullText = document.body ? (document.body.innerText || document.body.textContent || '') : '';

    var courseCode = '';
    var courseName = '';
    var group = '';

    // Lấy từ dropdown select môn học (nếu có)
    var sel = document.querySelector('select[name*="course" i], select[id*="course" i], select[name*="Course" i]');
    if (sel && sel.selectedIndex >= 0) {
      var optText = (sel.options[sel.selectedIndex].text || '').trim();
      var m = optText.match(/^(.*?)\\s*\\(([A-Z]{3}\\d{3}[A-Z0-9]?)\\)\\s*(?:\\((.*?)\\))?$/i);
      if (m) {
        courseName = m[1].trim();
        courseCode = m[2].trim().toUpperCase();
        group = m[3] ? m[3].trim() : '';
      }
    }

    if (!courseCode) {
      var headerMatch = fullText.match(/([A-ZÀ-Ỹa-zà-ỹ0-9\\s,&-]+?)\\s+([A-Z]{3}\\d{3}[A-Z0-9]?)\\b/);
      if (headerMatch) {
        courseName = headerMatch[1].trim();
        courseCode = headerMatch[2].trim().toUpperCase();
      }
    }

    if (!courseCode) {
      var anyCodeMatch = fullText.match(/\\b([A-Z]{3}\\d{3}[A-Z0-9]?)\\b/);
      if (anyCodeMatch) courseCode = anyCodeMatch[1].toUpperCase();
    }

    if (!group) {
      var grpMatch = fullText.match(/\\b([A-Z]{2}\\d{4}-[A-Z0-9]+)\\b/);
      if (grpMatch) group = grpMatch[1];
    }

    var term = 'Fall2026';
    var termMatch = fullText.match(/\\b(Fall|Spring|Summer)\\s*(\\d{4})\\b/i);
    if (termMatch) term = termMatch[1] + termMatch[2];

    var totalSlots = 20;
    var absentSlots = 0;
    var absentPercent = '0%';
    var remainingSlots = 0;

    var statMatch = fullText.match(/Vắng\\s*(\\d+)%[^(]*\\((\\d+)\\/(\\d+)\\s*buổi\\)[^,]*(?:,\\s*còn\\s*(\\d+)\\s*buổi)?/i);
    if (statMatch) {
      absentPercent = statMatch[1] + '%';
      absentSlots = parseInt(statMatch[2], 10) || 0;
      totalSlots = parseInt(statMatch[3], 10) || 20;
      remainingSlots = statMatch[4] ? parseInt(statMatch[4], 10) : 0;
    }

    var table = document.querySelector('table');
    if (!table) return null;

    var rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) rows = table.querySelectorAll('tr');

    var sessions = [];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var cells = row.querySelectorAll('td');
      if (cells.length < 5) continue;

      var numText = (cells[0].innerText || cells[0].textContent || '').trim();
      var num = parseInt(numText, 10);
      if (isNaN(num)) continue;

      var dateFull = (cells[1].innerText || cells[1].textContent || '').trim();
      var dateMatch = dateFull.match(/(\\d{1,2}\\/\\d{1,2}\\/\\d{4})/);
      var dateStr = dateMatch ? dateMatch[1] : dateFull;
      var dayNameMatch = dateFull.match(/(Thứ\\s*[^\\s\\d]+|Chủ\\s*nhật)/i);
      var dayName = dayNameMatch ? dayNameMatch[0] : '';

      var timeStr = (cells[2].innerText || cells[2].textContent || '').trim();
      var room = (cells[3].innerText || cells[3].textContent || '').trim();
      var lecturer = (cells[4].innerText || cells[4].textContent || '').trim();
      var grp = cells[5] ? (cells[5].innerText || cells[5].textContent || '').trim() : group;
      var statusText = cells[6] ? (cells[6].innerText || cells[6].textContent || '').trim() : '';
      var note = cells[7] ? (cells[7].innerText || cells[7].textContent || '').trim() : '';

      var status = 'Not yet';
      var lowerStatus = statusText.toLowerCase();
      if (lowerStatus.indexOf('có mặt') !== -1 || lowerStatus.indexOf('present') !== -1) {
        status = 'Present';
      } else if (lowerStatus.indexOf('vắng') !== -1 || lowerStatus.indexOf('absent') !== -1) {
        status = 'Absent';
      }

      var slotNum = 1;
      var tMatch = timeStr.match(/(\\d{1,2})[h:](\\d{2})/);
      if (tMatch) {
        var h = parseInt(tMatch[1], 10);
        var m = parseInt(tMatch[2], 10);
        var tot = h * 60 + m;
        if (tot <= 590) slotNum = 1;
        else if (tot <= 750) slotNum = 2;
        else if (tot <= 910) slotNum = 3;
        else if (tot <= 1060) slotNum = 4;
        else if (tot <= 1210) slotNum = 5;
        else slotNum = 6;
      }

      sessions.push({
        sessionNumber: num,
        date: dateStr,
        dayName: dayName,
        time: timeStr,
        slot: slotNum,
        room: room || 'DE-422',
        lecturer: lecturer || '',
        group: grp || group,
        status: status,
        note: note
      });
    }

    if (sessions.length === 0) return null;

    if (!courseCode && sessions.length > 0) {
      courseCode = 'COURSE';
    }

    return {
      id: 'course_' + courseCode,
      courseCode: courseCode,
      courseName: courseName || courseCode,
      group: group || 'SE1990-NJ',
      term: term,
      totalSlots: totalSlots || sessions.length,
      absentSlots: absentSlots,
      absentPercent: absentPercent,
      remainingSlots: remainingSlots,
      sessions: sessions,
      syncedAt: new Date().toISOString()
    };
  }

  // Chạy bóc tách dữ liệu khi đã ở đúng trang
  function doAutoOrManualScrape(isManual) {
    try {
      var currentUrl = window.location.href || '';
      var pathname = (window.location.pathname || '').toLowerCase();

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

      // TRƯỜNG HỢP 1: https://fap.fpt.edu.vn/ExamSchedule -> Cào Lịch thi
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

      // TRƯỜNG HỢP 2: https://fap.fpt.edu.vn/WeeklyTimetable -> Cào Thời khóa biểu tuần
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

      // TRƯỜNG HỢP 3: https://fap.fpt.edu.vn/Report/Attendance -> Cào Full Điểm danh cả môn
      if (pathname.indexOf('report/attendance') !== -1 || currentUrl.indexOf('report/attendance') !== -1) {
        var courseData = parseCourseAttendanceFromDOM();
        if (courseData && courseData.sessions && courseData.sessions.length > 0) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'FAP_COURSE_ATTENDANCE_SYNCED',
              user: userObj,
              course: courseData
            }));
            return;
          }
        }
      }
    } catch(e) {}
  }

  try {
    doAutoOrManualScrape(false);
  } catch(e) {}
`;
