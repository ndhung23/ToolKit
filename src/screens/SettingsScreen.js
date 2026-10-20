import { View, Text } from 'react-native';
import { Row } from '../components/ui';
import { radius, useTheme } from '../theme';

export default function SettingsScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      <View style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <Row icon="color-palette-outline" label="Giao diện" value="Theo hệ thống" />
        <Row icon="notifications-outline" label="Thông báo" value="Chưa làm" />
        <Row icon="information-circle-outline" label="Phiên bản" value="1.0.0" />
      </View>
      <Text style={{ color: colors.sub, marginTop: 16, textAlign: 'center' }}>
        Giao diện sáng/tối đổi theo cài đặt của iPhone.
      </Text>
    </View>
  );
}
