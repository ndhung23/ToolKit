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
import { PLATFORMS } from './fbAccountStorage';

export default function FbAccountSwitcherBar({
  accounts = [],
  activeAccountId,
  onSwitchAccount,
  onAddAccount,
  onLongPressAccount,
  onBack,
  onReload,
}) {
  const { colors } = useTheme();
  const [failedImages, setFailedImages] = useState({});

  const handleImageError = (id) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case PLATFORMS.FACEBOOK:
        return { name: 'logo-facebook', color: '#1877F2' };
      case PLATFORMS.ZALO:
        return { name: 'chatbubbles', color: '#0068FF' };
      case PLATFORMS.MESSENGER:
      default:
        return { name: 'chatbubble-ellipses', color: '#0084FF' };
    }
  };

  const renderAccountItem = ({ item }) => {
    const isAct = item.key === activeAccountId || item.id === activeAccountId;
    const isImageBroken = failedImages[item.id] || !item.avatarUrl;
    const initial = (item.nickname || item.name || 'U').charAt(0).toUpperCase();
    const platIcon = getPlatformIcon(item.platform);

    return (
      <Pressable
        onPress={() => onSwitchAccount && onSwitchAccount(item)}
        onLongPress={() => onLongPressAccount && onLongPressAccount(item)}
        delayLongPress={350}
        style={[
          styles.itemWrapper,
          isAct && { borderColor: colors.primary, backgroundColor: 'rgba(255, 208, 0, 0.12)' },
        ]}
      >
        <View style={styles.avatarContainer}>
          {!isImageBroken ? (
            <Image
              source={{ uri: item.avatarUrl }}
              style={[
                styles.avatar,
                isAct && { borderColor: colors.primary, borderWidth: 2 },
              ]}
              onError={() => handleImageError(item.id)}
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                { backgroundColor: isAct ? colors.primary : '#2C2C34' },
                isAct && { borderColor: colors.primary, borderWidth: 2 },
              ]}
            >
              <Text style={[styles.avatarInitial, { color: isAct ? '#121214' : '#FFFFFF' }]}>
                {initial}
              </Text>
            </View>
          )}

          {/* Badge logo nền tảng ở góc dưới avatar */}
          <View style={[styles.platformBadge, { backgroundColor: '#121214' }]}>
            <Ionicons name={platIcon.name} size={11} color={platIcon.color} />
          </View>
        </View>

        <Text
          numberOfLines={1}
          style={[
            styles.nameText,
            { color: isAct ? colors.primary : colors.text },
            isAct && styles.nameTextActive,
          ]}
        >
          {item.nickname || item.name || item.id.slice(-4)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.barRoot, { backgroundColor: '#18181C', borderBottomColor: colors.cardBorder }]}>
      {/* Nút Back quay về menu chính của ToolKit */}
      {onBack && (
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
      )}

      {/* Danh sách các tài khoản đang lưu */}
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.key || item.id}
        renderItem={renderAccountItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />

      {/* Cụm nút công cụ bên phải: Thêm nick (+) và Làm mới trang */}
      <View style={styles.actionsRight}>
        <Pressable
          onPress={onAddAccount}
          style={[styles.actionBtn, { backgroundColor: 'rgba(24, 119, 242, 0.18)' }]}
          hitSlop={8}
        >
          <Ionicons name="add" size={20} color="#1877F2" />
        </Pressable>

        {onReload && (
          <Pressable
            onPress={onReload}
            style={[styles.actionBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
            hitSlop={8}
          >
            <Ionicons name="reload" size={17} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barRoot: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  listContent: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  itemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    maxWidth: 130,
    gap: 6,
  },
  avatarContainer: {
    position: 'relative',
    width: 32,
    height: 32,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C34',
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '800',
  },
  platformBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 11.5,
    fontWeight: '600',
    maxWidth: 76,
  },
  nameTextActive: {
    fontWeight: '800',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
