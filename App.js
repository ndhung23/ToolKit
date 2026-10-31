import 'react-native-gesture-handler'; // phải nằm dòng đầu tiên (cần cho Drawer)
import { Platform, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/features/auth/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { ScreenTimeProvider } from './src/features/screentime/ScreenTimeContext';
import { ThemeProvider, useTheme } from './src/theme';
import RootNavigator from './src/navigation';
import AiFloatingBot from './src/components/AiFloatingBot';

// Polyfill Alert.alert cho React Native Web (tránh lỗi Alert rỗng không hoạt động trên trình duyệt)
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n');
    if (!buttons || buttons.length === 0) {
      window.alert(text);
      return;
    }
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    const actionBtns = buttons.filter((b) => b.style !== 'cancel');

    if (actionBtns.length > 0 && cancelBtn) {
      const ok = window.confirm(text);
      if (ok) {
        actionBtns[0]?.onPress?.();
      } else {
        cancelBtn?.onPress?.();
      }
    } else if (actionBtns.length > 0) {
      window.alert(text);
      actionBtns[0]?.onPress?.();
    } else {
      window.alert(text);
    }
  };
}

function MainApp() {
  const { colors, isDark } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
      <AiFloatingBot />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ScreenTimeProvider>
              <MainApp />
            </ScreenTimeProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
