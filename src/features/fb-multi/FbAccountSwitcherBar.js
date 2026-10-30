import { useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme';

export default function FbAccountSwitcherBar({
  accounts = [],
  activeAccountId,
  onSwitchAccount,
  onAddAccount,
  onLongPressAccount,
}) {
  const { colors } = useTheme();
  const [failedImages, setFailedImages] = useState({});

  const handleImageError = (id) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  const renderAccountItem = ({ item }) => {
    const isActive = item.id === activeAccountId;
    const displayName = item.nickname || item.name || `UID ${item.id.slice(-4)}`;
    const initial = (item.name || item.id || 'F').charAt(0).toUpperCase();
    const isImageBroken = failedImages[item.id] || !item.avatarUrl;

    return (
      <Pressable
        onPress={() => onSwitchAccount && onSwitchAccount(item)}
        onLongPress={() => onLongPressAccount && onLongPressAccount(item)}
        delayLongPress={400}
        style={[
          styles.itemContainer,
          isActive && { borderColor: colors.primary, backgroundColor: 'rgba(255, 208, 0, 0.08)' },
        ]}
      >
        <View style={styles.avatarWrapper}>
          {!isImageBroken ? (
            <Image
              source={{ uri: item.avatarUrl }}
              style={[
                styles.avatar,
                isActive && { borderColor: colors.primary, borderWidth: 2 },
              ]}
              onError={() => handleImageError(item.id)}
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                { backgroundColor: isActive ? colors.primary : '#2C2C34' },
                isActive && { borderColor: colors.primary, borderWidth: 2 },
              ]}
            >
              <Text
                style={[
                  styles.avatarInitial,
                  { color: isActive ? '#121214' : '#FFFFFF' },
                ]}
              >
                {initial}
              </Text>
            </View>
          )}

          {/* Dấu chấm xanh thông báo tài khoản đang hoạt động */}
          {isActive && <View style={styles.activeDot} />}
        </View>

        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.nameText,
            { color: isActive ? colors.primary : colors.text },
            isActive && styles.nameTextActive,
          ]}
        >
          {displayName}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        renderItem={renderAccountItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          <Pressable
            onPress={onAddAccount}
            style={[styles.addBtn, { borderColor: colors.cardBorder, backgroundColor: colors.bg }]}
          >
            <View style={[styles.addIconCircle, { backgroundColor: 'rgba(24, 119, 242, 0.15)' }]}>
              <Ionicons name="add" size={20} color="#1877F2" />
            </View>
            <Text style={[styles.addText, { color: colors.sub }]}>Thêm nick</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
  itemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 68,
    maxWidth: 88,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C34',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '800',
  },
  activeDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#121214',
  },
  nameText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  nameTextActive: {
    fontWeight: '800',
  },
  addBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    minWidth: 68,
  },
  addIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  addText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
