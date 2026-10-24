// src/features/fap/FapSilentAutoChecker.js
// Module cào dữ liệu ngầm (Silent Auto-Fetch) từ fap.fpt.edu.vn/WeeklyTimetable
// Tự động kiểm tra điểm danh khi mở app hoặc khi chạm thông báo hệ thống (+10p sau ca học)

import React, { useEffect, useRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { FAP_SCRAPER_INJECTED_JS } from './fapScraperScript';
import { filterSlotsForToday } from './fapAttendanceHelper';

let NativeWebView = null;
if (Platform.OS !== 'web') {
  try {
    NativeWebView = require('react-native-webview').WebView;
  } catch (e) {
    console.warn('[FapSilentAutoChecker] Native WebView not available:', e);
  }
}

export default function FapSilentAutoChecker({
  active = false,
  todaySlots = [],
  onCheckComplete,
  onStatusChange,
  onError,
  onFinish,
}) {
  const webViewRef = useRef(null);
  const timeoutTimerRef = useRef(null);
  const hasFinishedCurrentRunRef = useRef(false);

  useEffect(() => {
    if (!active) {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      hasFinishedCurrentRunRef.current = false;
      return;
    }

    if (Platform.OS === 'web' || !NativeWebView) {
      onError?.('Silent Auto-Fetch hoạt động tự động trên điện thoại (Android / iOS)');
      onFinish?.();
      return;
    }

    onStatusChange?.('Đang kết nối FAP ngầm...');
    hasFinishedCurrentRunRef.current = false;

    // Giới hạn thời gian cào tối đa 15s để tránh tốn pin nếu mạng chập chờn
    timeoutTimerRef.current = setTimeout(() => {
      onStatusChange?.('');
      onError?.('Hết thời gian kết nối FAP ngầm');
      onFinish?.();
    }, 15000);

    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, [active, onError, onFinish, onStatusChange]);

  if (!active || Platform.OS === 'web' || !NativeWebView) {
    return null;
  }

  const handleMessage = (event) => {
    if (hasFinishedCurrentRunRef.current) return;

    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'FAP_WEEKLY_TIMETABLE_SYNCED' && Array.isArray(data.slots) && data.slots.length > 0) {
        hasFinishedCurrentRunRef.current = true;
        if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

        onStatusChange?.('Đang so khớp kết quả điểm danh...');

        const liveTodaySlots = filterSlotsForToday(data.slots, new Date());
        const newAbsents = [];
        const newPresents = [];

        liveTodaySlots.forEach((newSlot) => {
          const oldSlot = todaySlots.find(
            (s) =>
              Number(s.slot) === Number(newSlot.slot) &&
              (!s.date || !newSlot.date || s.date === newSlot.date)
          );

          const isNowAbsent =
            newSlot.status === 'Absent' ||
            newSlot.status?.toLowerCase() === 'absent' ||
            newSlot.status?.toLowerCase() === 'vắng';

          const isNowPresent =
            newSlot.status === 'Present' ||
            newSlot.status?.toLowerCase() === 'present' ||
            newSlot.status?.toLowerCase() === 'có mặt';

          const wasUnknown =
            !oldSlot ||
            oldSlot.status === 'Not yet' ||
            oldSlot.status?.toLowerCase() === 'chưa điểm danh' ||
            !oldSlot.status;

          if (isNowAbsent && wasUnknown) {
            newAbsents.push(newSlot);
          } else if (isNowPresent && wasUnknown) {
            newPresents.push(newSlot);
          }
        });

        onCheckComplete?.({
          allSlots: data.slots,
          liveTodaySlots,
          newAbsents,
          newPresents,
          user: data.user,
        });

        onFinish?.();
      }
    } catch (e) {
      console.warn('[FapSilentAutoChecker] Parse error:', e);
    }
  };

  const handleNavigationStateChange = (navState) => {
    const url = (navState.url || '').toLowerCase();
    // Nếu bị chuyển hướng về màn hình đăng nhập -> phiên đã hết hạn
    if (url.includes('/auth/login') || url.includes('feid.fpt.edu.vn') || url.includes('accounts.google.com')) {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      hasFinishedCurrentRunRef.current = true;
      onError?.('Phiên đăng nhập FAP đã hết hạn. Vui lòng mở lại FAP để đăng nhập.');
      onFinish?.();
    }
  };

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <NativeWebView
        ref={webViewRef}
        source={{ uri: 'https://fap.fpt.edu.vn/WeeklyTimetable' }}
        injectedJavaScript={FAP_SCRAPER_INJECTED_JS}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        style={styles.hiddenWebView}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    width: 1,
    height: 1,
    bottom: -500,
    left: -500,
    zIndex: -9999,
    opacity: 0,
  },
  hiddenWebView: {
    width: 1,
    height: 1,
  },
});
