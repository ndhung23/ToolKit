// src/context/ScreenTimeContext.js
// Quản lý theo dõi thời gian sử dụng thiết bị toàn cục, Local Push Notifications & Alert

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import * as SecureStore from '../utils/storage';
import * as Notifications from 'expo-notifications';

const STORAGE_LIMIT_MINUTES = 'toolkit_screentime_limit_minutes';
const STORAGE_ALERT_ENABLED = 'toolkit_screentime_alert_enabled';
const STORAGE_TODAY_MINUTES = 'toolkit_screentime_today_minutes';
const STORAGE_DATE_KEY = 'toolkit_screentime_last_date';

// Cấu hình hiển thị thông báo đẩy ngay cả khi app đang mở
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const ScreenTimeContext = createContext(null);

export function ScreenTimeProvider({ children }) {
  // Số phút cảnh báo (mặc định 180 phút như người dùng yêu cầu)
  const [alertLimitMinutes, setAlertLimitMinutes] = useState(180);
  const [alertEnabled, setAlertEnabled] = useState(true);

  // Số giây sử dụng liên tục trong phiên hiện tại
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Tổng số phút sử dụng trong ngày hôm nay
  const [totalTodayMinutes, setTotalTodayMinutes] = useState(135);

  // Cờ đánh dấu đã bắn cảnh báo trong ngưỡng hiện tại chưa (tránh spam Alert liên tục)
  const [isAlertTriggered, setIsAlertTriggered] = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const lastBackgroundTimeRef = useRef(null);
  const alertTriggeredRef = useRef(false);
  const limitMinutesRef = useRef(180);
  const alertEnabledRef = useRef(true);

  // Đồng bộ refs để truy cập an toàn trong setInterval
  useEffect(() => {
    alertTriggeredRef.current = isAlertTriggered;
  }, [isAlertTriggered]);

  useEffect(() => {
    limitMinutesRef.current = alertLimitMinutes;
  }, [alertLimitMinutes]);

  useEffect(() => {
    alertEnabledRef.current = alertEnabled;
  }, [alertEnabled]);

  // Nạp cấu hình từ SecureStore và yêu cầu quyền Thông báo khi khởi động app
  useEffect(() => {
    loadSettings();
    requestNotificationPermissions();
  }, []);

  // Xin quyền thông báo từ hệ điều hành iOS / Android
  const requestNotificationPermissions = async () => {
    try {
      if (Platform.OS === 'web') return false;
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    } catch (err) {
      console.warn('[ScreenTime] Lỗi xin quyền Notifications:', err);
      return false;
    }
  };

  // Lên lịch thông báo hệ thống khi app chạy nền hoặc bị tắt (giống Duolingo)
  const scheduleSystemReminder = async (minutes) => {
    try {
      if (Platform.OS === 'web') return;
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!alertEnabledRef.current || minutes <= 0) return;

      const remainingSec = Math.max(10, minutes * 60 - sessionSeconds);
      const hours = (minutes / 60).toFixed(1);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🦉 Cú ToolKit: Đã hết giờ dùng máy!',
          body: `Bạn ơi, bạn đã dùng máy liên tục ${minutes} phút (${hours} giờ) rồi! Cho mắt nghỉ ngơi 5-10 phút thôi nào!`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: remainingSec,
        },
      });
    } catch (err) {
      console.warn('[ScreenTime] Lỗi scheduleNotificationAsync:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const savedLimit = await SecureStore.getItemAsync(STORAGE_LIMIT_MINUTES);
      if (savedLimit) {
        const parsedLimit = parseInt(savedLimit, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          setAlertLimitMinutes(parsedLimit);
          limitMinutesRef.current = parsedLimit;
        }
      }

      const savedEnabled = await SecureStore.getItemAsync(STORAGE_ALERT_ENABLED);
      if (savedEnabled !== null) {
        const parsedEnabled = savedEnabled === 'true';
        setAlertEnabled(parsedEnabled);
        alertEnabledRef.current = parsedEnabled;
      }

      // Kiểm tra ngày hôm nay để nạp hoặc reset tổng thời gian ngày
      const todayStr = new Date().toISOString().slice(0, 10);
      const lastDate = await SecureStore.getItemAsync(STORAGE_DATE_KEY);
      if (lastDate === todayStr) {
        const savedToday = await SecureStore.getItemAsync(STORAGE_TODAY_MINUTES);
        if (savedToday) {
          setTotalTodayMinutes(parseInt(savedToday, 10) || 135);
        }
      } else {
        await SecureStore.setItemAsync(STORAGE_DATE_KEY, todayStr);
        await SecureStore.setItemAsync(STORAGE_TODAY_MINUTES, '135');
      }
    } catch (e) {
      console.warn('[ScreenTime] Không thể nạp cấu hình từ SecureStore:', e);
    }
  };

  // Cập nhật số phút cảnh báo
  const updateLimitMinutes = async (newMinutes) => {
    const mins = parseInt(String(newMinutes), 10);
    if (isNaN(mins) || mins <= 0) return false;

    setAlertLimitMinutes(mins);
    limitMinutesRef.current = mins;
    setIsAlertTriggered(false);
    alertTriggeredRef.current = false;

    // Lên lịch lại thông báo đẩy cho hệ điều hành
    await scheduleSystemReminder(mins);

    try {
      await SecureStore.setItemAsync(STORAGE_LIMIT_MINUTES, String(mins));
    } catch {}
    return true;
  };

  // Bật/tắt cảnh báo
  const toggleAlertEnabled = async (enabled) => {
    setAlertEnabled(enabled);
    alertEnabledRef.current = enabled;

    if (enabled) {
      await scheduleSystemReminder(limitMinutesRef.current);
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    }

    try {
      await SecureStore.setItemAsync(STORAGE_ALERT_ENABLED, String(enabled));
    } catch {}
  };

  // Đặt lại bộ đếm phiên sử dụng
  const resetSession = () => {
    setSessionSeconds(0);
    setIsAlertTriggered(false);
    alertTriggeredRef.current = false;
    scheduleSystemReminder(limitMinutesRef.current);
  };

  // Tạm hoãn cảnh báo thêm X phút (Snooze)
  const snooze = (minutes = 10) => {
    setIsAlertTriggered(false);
    alertTriggeredRef.current = false;
    scheduleSystemReminder(minutes);
    Alert.alert(
      'Đã tạm hoãn',
      `ToolKit sẽ nhắc nhở lại sau ${minutes} phút nữa.`
    );
  };

  // Phát cảnh báo in-app Alert
  const triggerUsageAlert = (minutesUsed) => {
    const hours = (minutesUsed / 60).toFixed(1);
    Alert.alert(
      '⚠️ CẢNH BÁO THỜI GIAN SỬ DỤNG',
      `Bạn đã sử dụng thiết bị liên tục ${minutesUsed} phút (${hours} giờ).\n\nHãy tạm dừng hoạt động, rời mắt khỏi màn hình và vận động nhẹ để bảo vệ sức khỏe và thị giác!`,
      [
        {
          text: 'Nghỉ ngơi ngay (Đặt lại)',
          style: 'default',
          onPress: () => resetSession(),
        },
        {
          text: 'Nhắc lại sau 10 phút',
          style: 'cancel',
          onPress: () => snooze(10),
        },
      ],
      { cancelable: false }
    );
  };

  // Nút thử nghiệm cảnh báo in-app Alert ngay lập tức
  const triggerTestAlert = () => {
    triggerUsageAlert(alertLimitMinutes);
  };

  // Nút thử nghiệm thông báo đẩy hệ thống (Sau 3 giây để người dùng khóa máy / thoát app kiểm tra)
  const triggerTestNotification = async (seconds = 3) => {
    try {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Cần cấp quyền Thông báo',
          'Vui lòng bật quyền Thông báo cho ToolKit trong phần Cài đặt máy để nhận được lời nhắc như Duolingo khi đã tắt app.'
        );
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🦉 Cú ToolKit: Đã hết giờ dùng máy!',
          body: `Bạn đã dùng thiết bị liên tục ${alertLimitMinutes} phút. Hãy tạm rời điện thoại và cho mắt thư giãn nhé!`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
        },
      });

      Alert.alert(
        '🔔 Đã hẹn giờ thông báo!',
        `Hệ thống sẽ gửi thông báo đẩy đến màn hình khóa sau ${seconds} giây. Bạn có thể khóa máy hoặc vuốt về màn hình Home ngay để kiểm tra thử!`
      );
    } catch (err) {
      Alert.alert('Lỗi gửi thông báo', err?.message);
    }
  };

  // Lắng nghe thay đổi trạng thái AppState
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (lastBackgroundTimeRef.current) {
          const diffMinutes = (Date.now() - lastBackgroundTimeRef.current) / 60000;
          if (diffMinutes >= 5) {
            // Đã khóa máy nghỉ ngơi trên 5 phút -> Reset phiên dùng máy
            resetSession();
          }
        }
      } else if (nextAppState.match(/inactive|background/)) {
        lastBackgroundTimeRef.current = Date.now();
        // Khi thoát ra màn hình chính, lên lịch thông báo trước cho hệ điều hành
        scheduleSystemReminder(limitMinutesRef.current);
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Bộ đếm thời gian thực tế mỗi giây khi app đang chạy
  useEffect(() => {
    const timer = setInterval(() => {
      if (appStateRef.current === 'active') {
        setSessionSeconds((prev) => {
          const nextSec = prev + 1;
          const currentMins = Math.floor(nextSec / 60);

          // Kiểm tra xem đã đạt ngưỡng cảnh báo chưa
          if (
            alertEnabledRef.current &&
            !alertTriggeredRef.current &&
            currentMins >= limitMinutesRef.current &&
            limitMinutesRef.current > 0
          ) {
            setIsAlertTriggered(true);
            alertTriggeredRef.current = true;
            triggerUsageAlert(limitMinutesRef.current);
          }

          return nextSec;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const sessionMinutes = Math.floor(sessionSeconds / 60);

  return (
    <ScreenTimeContext.Provider
      value={{
        alertLimitMinutes,
        alertEnabled,
        sessionSeconds,
        sessionMinutes,
        totalTodayMinutes,
        isAlertTriggered,
        updateLimitMinutes,
        toggleAlertEnabled,
        resetSession,
        snooze,
        triggerTestAlert,
        triggerTestNotification,
      }}
    >
      {children}
    </ScreenTimeContext.Provider>
  );
}

export function useScreenTime() {
  const context = useContext(ScreenTimeContext);
  if (!context) {
    throw new Error('useScreenTime must be used within a ScreenTimeProvider');
  }
  return context;
}
