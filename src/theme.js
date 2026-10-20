import { useColorScheme } from 'react-native';

const light = {
  bg: '#F4F5FB',
  card: '#FFFFFF',
  text: '#14142B',
  sub: '#6E7191',
  primary: '#5B5BF0',
  primary2: '#8B5CF6',
  border: '#E6E8F2',
  danger: '#EF4444',
};

const dark = {
  bg: '#0E0F1A',
  card: '#1A1B2E',
  text: '#F2F3FF',
  sub: '#9A9CC0',
  primary: '#7C7CFF',
  primary2: '#A78BFA',
  border: '#2A2B45',
  danger: '#F87171',
};

export const radius = { md: 14, lg: 20, xl: 28 };

// Tự đổi sáng/tối theo cài đặt hệ thống của iPhone
export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  return { colors: isDark ? dark : light, isDark };
}
