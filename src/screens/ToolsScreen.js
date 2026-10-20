import { useState } from 'react';
import { View, TextInput, FlatList, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ToolRow } from '../components/ui';
import { TOOLS, openTool } from '../tools';
import { radius, useTheme } from '../theme';

export default function ToolsScreen({ navigation }) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const data = TOOLS.filter((t) => t.title.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', margin: 16, marginBottom: 6,
          paddingHorizontal: 14, backgroundColor: colors.card, borderRadius: radius.md,
          borderWidth: 1, borderColor: colors.border,
        }}
      >
        <Ionicons name="search" size={18} color={colors.sub} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Tìm tiện ích..."
          placeholderTextColor={colors.sub}
          style={{ flex: 1, paddingVertical: 12, paddingLeft: 10, color: colors.text }}
        />
      </View>
      <FlatList
        data={data}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => <ToolRow tool={item} onPress={() => openTool(navigation, item)} />}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: colors.sub, marginTop: 40 }}>Không tìm thấy tiện ích.</Text>
        }
      />
    </View>
  );
}
