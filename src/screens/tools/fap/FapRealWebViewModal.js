// src/screens/tools/fap/FapRealWebViewModal.js
// Modal WebView kết nối Cổng FAP thật (fap.fpt.edu.vn) cho cả Mobile Native và Web

import React, { useState, useEffect, useRef } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

// Nạp an toàn WebView từ react-native-webview trên Mobile (tránh lỗi trên Web)
let NativeWebView = null;
if (Platform.OS !== 'web') {
  try {
    NativeWebView = require('react-native-webview').WebView;
  } catch (e) {
    console.warn('[FapWebView] Native WebView not available:', e);
  }
}

// Script tự động cào Lịch thi và Thông tin sinh viên từ FAP (Hỗ trợ cả giao diện Table và Card tiếng Anh / Việt)
const FAP_SCRAPER_INJECTED_JS = `
(function() {
  function runScrape() {
    try {
      var currentUrl = window.location.href;
      if (currentUrl.indexOf('/Auth/Login') !== -1 || currentUrl.indexOf('accounts.google.com') !== -1 || currentUrl.indexOf('feid.fpt.edu.vn') !== -1) {
        return;
      }

      var fullText = document.body.innerText || '';
      var rollNumber = '';
      var rollMatch = fullText.match(/\\b([A-Z]{2}\\d{5,7})\\b/i);
      if (rollMatch) rollNumber = rollMatch[1].toUpperCase();

      var studentName = '';
      var nameMatch = fullText.match(/TH\\u00d4NG TIN SINH VI\\u00caN[\\s\\n]+([^\\n\\r]+)/i);
      if (nameMatch && nameMatch[1]) {
        studentName = nameMatch[1].trim();
      }

      var program = '';
      var progMatch = fullText.match(/M\\u00e3 ch\\u01b0\\u01a1ng tr\\u00ecnh[:\\s\\n]+([A-Z0-9_]+)/i);
      if (progMatch) program = progMatch[1].trim();

      if (currentUrl.indexOf('/ExamSchedule') === -1) {
        fetch('/ExamSchedule', { credentials: 'include' })
          .then(function(r) { return r.text(); })
          .then(function(html) { parseContent(html, studentName, rollNumber, program); })
          .catch(function() { window.location.href = 'https://fap.fpt.edu.vn/ExamSchedule'; });
        return;
      }

      parseContent(document.documentElement.outerHTML, studentName, rollNumber, program);
    } catch(e) {}
  }

  function parseContent(html, sName, sRoll, sProg) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var rawText = doc.body ? doc.body.innerText : '';
    var lines = rawText.split(/\\r?\\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    var exams = [];
    var current = null;
    var lastKey = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var upper = line.toUpperCase();

      if (/^(DATE|NG\\u00c0Y)$/i.test(line) || upper.startsWith('DATE:') || upper.startsWith('NG\\u00c0Y:')) {
        if (current && (current.date || current.subjectCode)) exams.push(current);
        current = { id: 'fap_real_' + Date.now() + '_' + exams.length, date: '', time: '', room: '', subjectCode: '', subjectName: '', examForm: 'Practical_Exam', examType: 'PE', publishDate: '', note: '', reminderEnabled: true, customReminderMinutes: null, notified: false };
        lastKey = 'date';
        var val = line.replace(/^(DATE|NG\\u00c0Y)[:\\s]*/i, '').trim();
        if (val) current.date = val;
        continue;
      }

      if (current) {
        if (/^(TIME|TH\\u1edcI GIAN|GI\\u1edc)$/i.test(line) || upper.startsWith('TIME:') || upper.startsWith('TH\\u1edcI GIAN:')) {
          lastKey = 'time';
          var v = line.replace(/^(TIME|TH\\u1edcI GIAN|GI\\u1edc)[:\\s]*/i, '').trim();
          if (v) current.time = v;
        } else if (/^(ROOM|PH\\u00d2NG|PH\\u00d2NG THI)$/i.test(line) || upper.startsWith('ROOM:') || upper.startsWith('PH\\u00d2NG:')) {
          lastKey = 'room';
          var v = line.replace(/^(ROOM|PH\\u00d2NG|PH\\u00d2NG THI)[:\\s]*/i, '').trim();
          if (v) current.room = v;
        } else if (/^(SUBJECT|M\\u00d4N|M\\u00d4N THI)$/i.test(line) || upper.startsWith('SUBJECT:') || upper.startsWith('M\\u00d4N:')) {
          lastKey = 'subject';
          var v = line.replace(/^(SUBJECT|M\\u00d4N|M\\u00d4N THI)[:\\s]*/i, '').trim();
          if (v) { var sp = v.split(/\\s*-\\s*/); current.subjectCode = sp[0].trim(); current.subjectName = sp.slice(1).join(' - ').trim() || v; }
        } else if (/^(EXAM FORMAT|H\\u00ccNH TH\\u1ee8C|H\\u00ccNH TH\\u1ee8C THI)$/i.test(line) || upper.startsWith('EXAM FORMAT:') || upper.startsWith('H\\u00ccNH TH\\u1ee8C:')) {
          lastKey = 'format';
          var v = line.replace(/^(EXAM FORMAT|H\\u00ccNH TH\\u1ee8C|H\\u00ccNH TH\\u1ee8C THI)[:\\s]*/i, '').trim();
          if (v) current.examForm = v;
        } else if (/^(EXAM TYPE|LO\\u1ea0I THI)$/i.test(line) || upper.startsWith('EXAM TYPE:') || upper.startsWith('LO\\u1ea0I THI:')) {
          lastKey = 'type';
          var v = line.replace(/^(EXAM TYPE|LO\\u1ea0I THI)[:\\s]*/i, '').trim();
          if (v) current.examType = v;
        } else if (/^(GRADE PUBLICATION DATE|NG\\u00c0Y C\\u00d4NG B\\u1ed0|NG\\u00c0Y C\\u00d4NG B\\u1ed0 \\u0110I\\u1ec2M)$/i.test(line) || upper.startsWith('GRADE PUBLICATION DATE:') || upper.startsWith('NG\\u00c0Y C\\u00d4NG B\\u1ed0:')) {
          lastKey = 'publishDate';
          var v = line.replace(/^(GRADE PUBLICATION DATE|NG\\u00c0Y C\\u00d4NG B\\u1ed0|NG\\u00c0Y C\\u00d4NG B\\u1ed0 \\u0110I\\u1ec2M)[:\\s]*/i, '').trim();
          if (v) current.publishDate = v;
        } else if (/^(ATTENDANCE NOTE|GHI CH\\u00da \\u0110I\\u1ec2M DANH|NOTE|GHI CH\\u00da)$/i.test(line)) {
          lastKey = 'note';
        } else {
          if (lastKey === 'date' && !current.date && /\\d{2}\\/\\d{2}\\/\\d{4}/.test(line)) current.date = line;
          else if (lastKey === 'time' && !current.time) current.time = line.replace(/\\s+/g, '');
          else if (lastKey === 'room' && !current.room) current.room = line;
          else if (lastKey === 'subject' && !current.subjectCode) { var sp = line.split(/\\s*-\\s*/); current.subjectCode = sp[0].trim(); current.subjectName = sp.slice(1).join(' - ').trim() || line; }
          else if (lastKey === 'format' && !current.examForm) current.examForm = line;
          else if (lastKey === 'type' && !current.examType) current.examType = line;
          else if (lastKey === 'publishDate' && !current.publishDate && /\\d{2}\\/\\d{2}\\/\\d{4}/.test(line)) current.publishDate = line;
        }
      }
    }
    if (current && (current.date || current.subjectCode)) exams.push(current);

    var payload = {
      type: 'FAP_EXAM_SCHEDULE_SYNCED',
      user: {
        name: sName || 'Sinh vi\\u00ean FPT',
        studentId: sRoll || 'HE180000',
        program: sProg || 'BIT_SE_19C_NJ',
        campus: 'C\\u01a1 s\\u1edf H\\u00e0 N\\u1ed9i (HN)',
        email: (sRoll ? sRoll.toLowerCase() : 'student') + '@fpt.edu.vn'
      },
      exams: exams
    };

    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  setTimeout(runScrape, 1500);
  true;
})();
`;

export default function FapRealWebViewModal({
  visible,
  onClose,
  colors,
  onSyncSuccess,
  onOpenPasteModal,
}) {
  const [currentUrl, setCurrentUrl] = useState('https://fap.fpt.edu.vn/Auth/Login?ReturnUrl=%2F');
  const [loading, setLoading] = useState(false);
  const webViewRef = useRef(null);

  // Xử lý khi nhận message từ Native WebView trên Mobile
  const handleNativeMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'FAP_EXAM_SCHEDULE_SYNCED') {
        if (data.exams && data.exams.length > 0) {
          onSyncSuccess(data.user, data.exams);
          Alert.alert(
            'Đồng bộ thành công!',
            `Đã lấy được ${data.exams.length} môn thi từ tài khoản FAP của ${data.user?.name || 'bạn'}.`,
            [{ text: 'Xem lịch thi', style: 'default' }]
          );
          onClose();
        } else {
          Alert.alert('Thông báo', 'Đăng nhập thành công nhưng chưa tìm thấy lịch thi mới trên trang FAP.');
        }
      }
    } catch (e) {
      console.warn('[FapWebView] Parse message error:', e);
    }
  };

  const handleOpenFapWeb = () => {
    Linking.openURL('https://fap.fpt.edu.vn/ExamSchedule');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header Thanh điều khiển WebView */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
          <Pressable onPress={onClose} style={styles.headerBtn}>
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

          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web' && webViewRef.current) {
                webViewRef.current.reload();
              } else {
                handleOpenFapWeb();
              }
            }}
            style={styles.headerBtn}
          >
            <Ionicons name="reload" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {loading && (
          <View style={[styles.progressBar, { backgroundColor: colors.primary }]}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}

        {/* Nội dung: Native WebView trên Mobile HOẶC Web Sync Console trên Web */}
        {Platform.OS !== 'web' && NativeWebView ? (
          <NativeWebView
            ref={webViewRef}
            source={{ uri: 'https://fap.fpt.edu.vn/Auth/Login?ReturnUrl=%2F' }}
            userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            javaScriptEnabled={true}
            domStorageEnabled={true}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            injectedJavaScript={FAP_SCRAPER_INJECTED_JS}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onNavigationStateChange={(navState) => {
              setCurrentUrl(navState.url);
              // Nếu người dùng vào được FAP hoặc ExamSchedule thì inject cào
              if (navState.url.includes('fap.fpt.edu.vn') && !navState.url.includes('/Auth/Login')) {
                webViewRef.current?.injectJavaScript(FAP_SCRAPER_INJECTED_JS);
              }
            }}
            onMessage={handleNativeMessage}
            style={styles.webview}
          />
        ) : (
          <View style={styles.webSyncContainer}>
            <View style={[styles.webSyncCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.badgeRow}>
                <Ionicons name="phone-portrait-outline" size={20} color="#3B82F6" />
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
                  Cơ chế WebView cào dữ liệu FAP cho Sinh viên
                </Text>
              </View>

              <Text style={[styles.webSyncTitle, { color: colors.text }]}>
                Đăng nhập Cổng FAP Tự Động 100%
              </Text>

              <View style={[styles.infoBannerBox, { backgroundColor: 'rgba(59, 130, 246, 0.08)', borderColor: '#3B82F6' }]}>
                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>
                  📱 <Text style={{ fontWeight: '800' }}>Trên điện thoại (iOS / Android):</Text> Khi sinh viên mở app, cửa sổ WebView nhúng của điện thoại sẽ mở trực tiếp trang FAP, sinh viên đăng nhập tài khoản Google trường và app tự động cào 100% lịch thi thật mà không cần bất kỳ file trung gian nào.
                </Text>
              </View>

              <View style={[styles.infoBannerBox, { backgroundColor: 'rgba(234, 179, 8, 0.08)', borderColor: '#EAB308' }]}>
                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>
                  💻 <Text style={{ fontWeight: '800' }}>Khi chạy thử trên máy tính (Web):</Text> Trình duyệt Chrome cấm nhúng FAP qua iframe do chính sách bảo mật trường học (X-Frame-Options). Bạn sử dụng 2 nút dưới đây để thao tác nhanh:
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 8 }}>
                <Pressable
                  onPress={handleOpenFapWeb}
                  style={[styles.actionButton, { backgroundColor: '#1E40AF' }]}
                >
                  <Ionicons name="open-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>1. Mở trang FAP (fap.fpt.edu.vn/ExamSchedule)</Text>
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
                    2. Dán lịch FAP vào App (Tự động bóc tách 0.1s)
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
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 13.5, fontWeight: '800' },
  headerSubtitle: { fontSize: 11, marginTop: 1 },
  progressBar: { height: 2, alignItems: 'center', justifyContent: 'center' },
  webview: { flex: 1 },
  webSyncContainer: { flex: 1, padding: 18, justifyContent: 'center', alignItems: 'center' },
  webSyncCard: { maxWidth: 520, width: '100%', borderRadius: 20, borderWidth: 1, padding: 22, gap: 14 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  webSyncTitle: { fontSize: 17, fontWeight: '900', lineHeight: 22 },
  webSyncDesc: { fontSize: 12.5, lineHeight: 18 },
  stepBox: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#121214', fontWeight: '900', fontSize: 12 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 },
  infoBannerBox: { padding: 12, borderRadius: 12, borderWidth: 1 },
});

