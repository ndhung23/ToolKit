import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { radius, useTheme } from '../theme';

// Thẻ tiện ích dạng lưới (màn Trang chủ)
export function ToolCard({ tool, onPress }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: '48%',
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <IconBox tool={tool} />
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{tool.title}</Text>
      {!tool.ready && (
        <Text style={{ color: colors.sub, fontSize: 12, marginTop: 4 }}>Sắp có</Text>
      )}
    </Pressable>
  );
}

// Dòng tiện ích dạng danh sách (màn Tiện ích)
export function ToolRow({ tool, onPress }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <IconBox tool={tool} small />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{tool.title}</Text>
        <Text style={{ color: colors.sub, fontSize: 13, marginTop: 2 }}>{tool.desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.sub} />
    </Pressable>
  );
}

function IconBox({ tool, small }) {
  const size = small ? 44 : 48;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: tool.color + '22',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: small ? 0 : 12,
      }}
    >
      <Ionicons name={tool.icon} size={24} color={tool.color} />
    </View>
  );
}

// Dòng thông tin dùng cho màn Cài đặt / Cá nhân
export function Row({ icon, label, value, onPress, danger }) {
  const { colors } = useTheme();
  const tint = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      <Text style={{ flex: 1, marginLeft: 12, fontSize: 15, color: tint }}>{label}</Text>
      {value ? <Text style={{ color: colors.sub }}>{value}</Text> : null}
    </Pressable>
  );
}
