import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { ToolCard } from '../components/ui';
import { TOOLS, openTool } from '../tools';
import { radius, useTheme } from '../theme';

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <LinearGradient
        colors={[colors.primary2, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius.xl, padding: 22, marginBottom: 24 }}
      >
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>Xin chào, {user.name} 👋</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>Hôm nay bạn muốn làm gì?</Text>
        <Pressable
          onPress={() => openTool(navigation, TOOLS[0])}
          style={{
            flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
            backgroundColor: '#fff', borderRadius: 999,
            paddingVertical: 10, paddingHorizontal: 16, marginTop: 18,
          }}
        >
          <Ionicons name="document-text" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 8 }}>Ghép ảnh thành PDF</Text>
        </Pressable>
      </LinearGradient>

      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Tiện ích</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
        {TOOLS.map((t) => (
          <ToolCard key={t.id} tool={t} onPress={() => openTool(navigation, t)} />
        ))}
      </View>
    </ScrollView>
  );
}
