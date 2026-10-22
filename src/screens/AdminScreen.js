import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Switch, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader, RoleBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import { ROLES } from '../constants/roles';
import { TOOLS } from '../tools';
import {
  isFirebaseConfigured,
  getAllUsersFromFirestore,
  updateUserRoleInFirestore,
  getFeatureTogglesFromFirestore,
  saveFeatureToggleToFirestore,
  saveUserToFirestore,
} from '../services/firebase';

// Dữ liệu người dùng mô phỏng (Dùng làm Fallback khi offline)
const INITIAL_USERS = [
  { id: '1', email: 'nguyenvana@gmail.com', name: 'Nguyễn Văn A', role: ROLES.FREE },
  { id: '2', email: 'tranvanb@vip.com', name: 'Trần Văn B', role: ROLES.VIP },
  { id: '3', email: 'lethic@gmail.com', name: 'Lê Thị C', role: ROLES.FREE },
  { id: '4', email: 'phamduyd@vip.com', name: 'Phạm Duy D', role: ROLES.VIP },
  { id: '5', email: 'hoangminhe@toolkit.com', name: 'Hoàng Minh E', role: ROLES.ADMIN },
];

export default function AdminScreen({ navigation }) {
  const { colors } = useTheme();
  const { user, switchRole, demoAccounts } = useAuth();
  const [loading, setLoading] = useState(false);
  const fbConnected = isFirebaseConfigured();

  // Trạng thái bật/tắt tính năng (Feature Toggles)
  const [featureStatus, setFeatureStatus] = useState(() =>
    TOOLS.reduce((acc, t) => ({ ...acc, [t.id]: true }), {})
  );

  // Danh sách người dùng quản trị
  const [usersList, setUsersList] = useState(INITIAL_USERS);

  // Tải dữ liệu từ Cloud Firestore khi mở màn hình
  useEffect(() => {
    (async () => {
      if (fbConnected) {
        setLoading(true);
        try {
          const [remoteUsers, remoteToggles] = await Promise.all([
            getAllUsersFromFirestore(),
            getFeatureTogglesFromFirestore(),
          ]);
          if (remoteUsers && remoteUsers.length > 0) {
            setUsersList(remoteUsers);
          }
          if (remoteToggles) {
            setFeatureStatus((prev) => ({ ...prev, ...remoteToggles }));
          }
        } catch (e) {
          console.log('[Admin] Lỗi nạp Firestore, sử dụng Fallback:', e?.message);
        } finally {
          setLoading(false);
        }
      }
    })();
  }, [fbConnected]);

  const toggleFeature = async (id) => {
    const nextVal = !featureStatus[id];
    setFeatureStatus((prev) => ({ ...prev, [id]: nextVal }));
    if (fbConnected) {
      await saveFeatureToggleToFirestore(id, nextVal);
    }
  };

  const toggleUserRole = async (userId) => {
    const targetUser = usersList.find((u) => u.id === userId);
    if (!targetUser) return;
    const nextRole = targetUser.role === ROLES.FREE ? ROLES.VIP : ROLES.FREE;

    setUsersList((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u))
    );

    if (fbConnected) {
      await updateUserRoleInFirestore(userId, nextRole);
    }
  };

  // Nạp dữ liệu mẫu lên Cloud Firestore
  const handleSeedCloudData = async () => {
    setLoading(true);
    try {
      for (const u of INITIAL_USERS) {
        await saveUserToFirestore('user_' + u.id, u);
      }
      for (const t of TOOLS) {
        await saveFeatureToggleToFirestore(t.id, true);
      }
      Alert.alert(
        'Đã gửi yêu cầu Cloud',
        'Đã đồng bộ danh sách người dùng và trạng thái 8 tiện ích lên Cloud Firestore!'
      );
      const freshUsers = await getAllUsersFromFirestore();
      if (freshUsers.length > 0) setUsersList(freshUsers);
    } catch (err) {
      Alert.alert(
        'Lưu ý Firebase Rules',
        'Vui lòng đảm bảo Firestore Rules trong Firebase Console đã được chuyển sang Test Mode (allow read, write: if true).'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Quản trị hệ thống (Admin)"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Admin Info & Firebase Status */}
        <View
          style={[
            styles.adminCard,
            { backgroundColor: colors.card, borderColor: 'rgba(239, 68, 68, 0.4)' },
          ]}
        >
          <View style={styles.adminCardTop}>
            <View style={styles.adminIconBox}>
              <Ionicons name="shield-checkmark" size={26} color="#EF4444" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.adminTitle}>Quyền Quản trị viên</Text>
                <RoleBadge role={user?.role} />
              </View>
              <Text style={[styles.adminDesc, { color: colors.sub }]}>
                {user?.email} • Toàn quyền cấu hình & kiểm soát ứng dụng
              </Text>

              {/* Huy hiệu trạng thái kết nối Database */}
              <View
                style={[
                  styles.dbStatusPill,
                  {
                    backgroundColor: fbConnected
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
                    borderColor: fbConnected ? '#10B981' : '#F59E0B',
                  },
                ]}
              >
                <Ionicons
                  name={fbConnected ? 'cloud-done' : 'cloud-offline'}
                  size={12}
                  color={fbConnected ? '#10B981' : '#F59E0B'}
                />
                <Text
                  style={[
                    styles.dbStatusText,
                    { color: fbConnected ? '#10B981' : '#F59E0B' },
                  ]}
                >
                  {fbConnected
                    ? 'Cloud Firestore: Đã kết nối Database'
                    : 'Chế độ an toàn: Fallback Database (Local Mock)'}
                </Text>
              </View>
            </View>
          </View>

          {/* Nút bấm Seed Data lên Firestore */}
          <Pressable
            onPress={handleSeedCloudData}
            disabled={loading}
            style={[styles.seedCloudBtn, { backgroundColor: colors.primary }]}
          >
            {loading ? (
              <ActivityIndicator color="#121214" size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={16} color="#121214" />
                <Text style={styles.seedCloudBtnText}>Nạp dữ liệu mẫu lên Cloud Firestore (1-chạm)</Text>
              </>
            )}
          </Pressable>
        </View>


        {/* 1. Thống kê hệ thống */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Tổng quan tài khoản</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statNum, { color: colors.text }]}>1,280</Text>
            <Text style={[styles.statLabel, { color: colors.sub }]}>Tổng người dùng</Text>
          </View>

          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statNum, { color: '#FFD000' }]}>342</Text>
            <Text style={[styles.statLabel, { color: colors.sub }]}>Thành viên VIP</Text>
          </View>

          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statNum, { color: '#10B981' }]}>938</Text>
            <Text style={[styles.statLabel, { color: colors.sub }]}>Người dùng Free</Text>
          </View>
        </View>

        {/* 2. Điều khiển trạng thái 8 tiện ích (Feature Flags) */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Trạng thái hoạt động 8 tiện ích
        </Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {TOOLS.map((t, idx) => {
            const isEnabled = featureStatus[t.id];
            return (
              <View
                key={t.id}
                style={[
                  styles.toolToggleRow,
                  {
                    borderBottomWidth: idx < TOOLS.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.toolIconCircle, { backgroundColor: t.color + '22' }]}>
                  <Ionicons name={t.icon} size={20} color={t.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.toolToggleName, { color: colors.text }]}>{t.title}</Text>
                  <Text style={[styles.toolToggleSub, { color: isEnabled ? '#10B981' : colors.danger }]}>
                    {isEnabled ? '● Đang hoạt động' : '○ Tạm khóa bảo trì'}
                  </Text>
                </View>
                <Switch
                  value={isEnabled}
                  onValueChange={() => toggleFeature(t.id)}
                  trackColor={{ false: '#3E3E42', true: colors.primary }}
                  thumbColor={isEnabled ? '#121214' : '#9E9EA7'}
                />
              </View>
            );
          })}
        </View>

        {/* 3. Quản lý phân quyền người dùng */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Phân quyền người dùng</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {usersList.map((u, idx) => (
            <View
              key={u.id}
              style={[
                styles.userRow,
                {
                  borderBottomWidth: idx < usersList.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <View style={styles.userAvatar}>
                <Ionicons name="person-circle" size={38} color={colors.sub} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.userName, { color: colors.text }]}>{u.name}</Text>
                <Text style={[styles.userEmail, { color: colors.sub }]}>{u.email}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <RoleBadge role={u.role} />
                {u.role !== ROLES.ADMIN && (
                  <Pressable
                    onPress={() => toggleUserRole(u.id)}
                    style={styles.roleActionBtn}
                    hitSlop={6}
                  >
                    <Text style={styles.roleActionBtnText}>
                      {u.role === ROLES.FREE ? 'Cấp VIP' : 'Hạ Free'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* 4. Bộ chuyển vai trò tức thì để kiểm thử đồ án */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Chuyển nhanh vai trò kiểm thử (MMA301)
        </Text>
        <View style={styles.quickRoleContainer}>
          {demoAccounts.map((acc) => (
            <Pressable
              key={acc.role}
              onPress={() => {
                switchRole(acc.role);
                Alert.alert(
                  'Đổi vai trò thành công',
                  `Bạn hiện đang trải nghiệm ứng dụng với vai trò: ${acc.name}.`,
                  [{ text: 'Đồng ý' }]
                );
              }}
              style={[
                styles.quickRoleBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: user?.role === acc.role ? colors.primary : colors.cardBorder,
                  borderWidth: user?.role === acc.role ? 2 : 1,
                },
              ]}
            >
              <Text style={[styles.quickRoleLabel, { color: colors.text }]}>{acc.name}</Text>
              <RoleBadge role={acc.role} />
            </Pressable>
          ))}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  adminCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 20,
    overflow: 'hidden',
  },
  adminCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  adminTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#EF4444',
  },
  adminDesc: {
    fontSize: 12.5,
    marginTop: 4,
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
    overflow: 'hidden',
  },
  statNum: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardGroup: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  toolToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  toolIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  toolToggleName: {
    fontSize: 14,
    fontWeight: '700',
  },
  toolToggleSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  userAvatar: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  roleActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#26262C',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#383842',
  },
  roleActionBtnText: {
    fontSize: 11,
    color: '#FFD000',
    fontWeight: '700',
  },
  quickRoleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  quickRoleBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  quickRoleLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  dbStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  dbStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  seedCloudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 14,
    gap: 8,
    overflow: 'hidden',
  },
  seedCloudBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#121214',
  },
});


