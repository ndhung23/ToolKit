import { useColorScheme } from 'react-native';

// Bảng màu chuẩn theo phong cách Derot / ToolKit (Dark matte + Vàng rực)
const derotDark = {
  bg: '#141416',
  card: '#222226',
  cardElevated: '#2A2A30',
  cardBorder: '#2E2E36',
  text: '#FFFFFF',
  sub: '#9E9EA7',
  subLight: '#CCCCCC',
  primary: '#FFD000',
  primaryDark: '#E6BA00',
  primaryLight: '#FFF08A',
  primaryMuted: 'rgba(255, 208, 0, 0.12)',
  primaryText: '#121214',
  border: '#2C2C34',
  borderActive: '#FFD000',
  tabBar: '#242429',
  tabBarBorder: '#32323B',
  circleBg: '#2A2A30',
  crownBg: '#FFD000',
  crownIcon: '#121214',
  gearBg: '#2B2B32',
  tagBg: '#2E2B1F',
  tagText: '#EAB308',
  danger: '#EF4444',
  success: '#10B981',
};

// Light theme vẫn giữ nét tinh tế nhưng tối ưu sang trọng
const derotLight = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  cardElevated: '#F0F0F3',
  cardBorder: '#E5E7EB',
  text: '#111827',
  sub: '#6B7280',
  subLight: '#4B5563',
  primary: '#EAB308',
  primaryDark: '#CA8A04',
  primaryLight: '#FEF08A',
  primaryMuted: 'rgba(234, 179, 8, 0.12)',
  primaryText: '#121214',
  border: '#E5E7EB',
  borderActive: '#EAB308',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  circleBg: '#F3F4F6',
  crownBg: '#EAB308',
  crownIcon: '#FFFFFF',
  gearBg: '#E5E7EB',
  tagBg: '#FEF9C3',
  tagText: '#A16207',
  danger: '#EF4444',
  success: '#10B981',
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export function useTheme() {
  const scheme = useColorScheme();
  // Ưu tiên hiển thị giao diện Dark đặc trưng của Derot (như trong ảnh mẫu)
  const isDark = scheme !== 'light'; 
  return { colors: isDark ? derotDark : derotLight, isDark: true };
}

