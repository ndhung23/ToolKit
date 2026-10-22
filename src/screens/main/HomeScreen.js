import { useState } from 'react';
import { View, Text, ScrollView, Alert, Share, StyleSheet } from 'react-native';
import {
  DerotHeader,
  FocusGauge,
  MindInsightCard,
  AchievementCard,
  ToolRow,
  ShareBanner,
  VipUpgradeModal,
} from '../../components/ui';
import { TOOLS, openTool } from '../../tools';
import { useTheme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { canAccessTool, isVip } from '../../constants/roles';

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [crownModalVisible, setCrownModalVisible] = useState(false);
  const [selectedLockedTool, setSelectedLockedTool] = useState(null);

  const vipActive = isVip(user);
  const accessibleCount = TOOLS.filter((t) => canAccessTool(user, t)).length;

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Trải nghiệm trọn bộ 8 tiện ích thông minh trên ToolKit: Ghép ảnh PDF, Chuyển khoản QR, Auto Click, AI trả lời tin nhắn...',
      });
    } catch (e) {
      // ignore
    }
  };

  const handleStatusPress = () => {
    if (vipActive) {
      Alert.alert(
        'Hệ thống ToolKit VIP',
        'Tất cả 8 tiện ích đã sẵn sàng hoạt động tối ưu trên thiết bị của bạn với tư cách VIP.',
        [{ text: 'Đồng ý' }]
      );
    } else {
      Alert.alert(
        'Tài khoản Free',
        `Bạn đang sử dụng ${accessibleCount}/8 tiện ích cơ bản. Quyền nâng cấp VIP do Quản trị viên hệ thống chỉ định.`,
        [
          { text: 'Đóng', style: 'cancel' },
          { text: 'Xem đặc quyền VIP', onPress: () => setCrownModalVisible(true) },
        ]
      );
    }
  };

  const handleToolPress = (tool) => {
    openTool(navigation, tool, user, (lockedTool) => {
      setSelectedLockedTool(lockedTool);
      setCrownModalVisible(true);
    });
  };


  return (
    <View style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* 1. Header chuẩn Derot với Logo bo tròn + Huy hiệu vai trò (Role badge) */}
      <DerotHeader
        title="ToolKit"
        userRole={user?.role}
        onCrownPress={() => {
          setSelectedLockedTool(null);
          setCrownModalVisible(true);
        }}
        onSettingsPress={() => navigation.navigate('Settings')}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Vòng tròn hiển thị số tiện ích được phép dùng */}
        <FocusGauge
          score={`${accessibleCount}/8`}
          label={vipActive ? 'Tiện ích VIP sẵn sàng' : 'Tiện ích khả dụng'}
          onPress={handleStatusPress}
        />

        {/* 3. Card trợ lý ToolKit Assistant */}
        <MindInsightCard
          title={vipActive ? 'ToolKit Assistant (VIP)' : 'ToolKit Assistant'}
          desc={
            vipActive
              ? 'Tất cả 8 tiện ích thông minh đã mở khóa đầy đủ quyền hạn.'
              : 'Đang dùng gói cơ bản. Nhấn vào vương miện để mở khóa toàn bộ tiện ích.'
          }
          onPress={handleStatusPress}
        />

        {/* 4. Card tiến độ hệ thống */}
        <AchievementCard
          title={vipActive ? 'Hệ thống VIP • 8/8 hoàn thiện' : 'Hệ thống • 5/8 khả dụng'}
          subtitle={vipActive ? 'Đầy đủ AI, Auto Click, Multi-FB & Quản lý' : 'Mở khóa 3 tính năng VIP để tối ưu trải nghiệm'}
          progress={accessibleCount / 8}
          onPress={() => navigation.navigate('Tools')}
        />

        {/* 5. Tiêu đề danh sách tính năng */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Danh sách tiện ích</Text>

        {/* 6. Danh sách 8 tính năng kèm trạng thái phân quyền */}
        {TOOLS.map((t) => {
          const isLocked = !canAccessTool(user, t);
          return (
            <ToolRow
              key={t.id}
              tool={t}
              locked={isLocked}
              onPress={() => handleToolPress(t)}
            />
          );
        })}

        {/* 7. Banner chia sẻ */}
        <ShareBanner onPress={handleShare} />

        {/* Khoảng trống để không bị che bởi Floating Tab Bar */}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Modal VIP dùng chung */}
      <VipUpgradeModal
        visible={crownModalVisible}
        tool={selectedLockedTool}
        onClose={() => {
          setCrownModalVisible(false);
          setSelectedLockedTool(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCrownIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  modalBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#121214',
  },
});
