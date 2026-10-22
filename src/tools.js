import { Alert } from 'react-native';
import { canAccessTool } from './constants/roles';
import { logToolUsageToFirestore } from './services/firebase';

// Danh sách 8 tính năng cốt lõi của ToolKit kèm phân quyền (tier: 'free' | 'vip')
export const TOOLS = [
  {
    id: 'pdf',
    title: 'Chuyển ảnh thành PDF',
    desc: 'Ghép nhiều ảnh thành một file PDF chất lượng cao',
    icon: 'document-text',
    color: '#EF4444',
    route: 'ImageToPdf',
    badge: 'Sẵn sàng',
    tier: 'free',
  },
  {
    id: 'autoclick',
    title: 'Auto Click — tự động chạm màn hình',
    desc: 'Tự động chạm màn hình theo chu kỳ & vị trí cài đặt',
    icon: 'finger-print',
    color: '#F59E0B',
    route: 'AutoClick',
    badge: 'VIP Pro',
    tier: 'vip',
  },
  {
    id: 'qr_transfer',
    title: 'Hỗ trợ chuyển khoản bằng QR',
    desc: 'Quét QR → nhập tiền, note → Chuyển qua ngân hàng để hoàn thành',
    icon: 'qr-code',
    color: '#10B981',
    route: 'QrTransfer',
    badge: 'Tiện lợi',
    tier: 'free',
  },
  {
    id: 'screentime',
    title: 'Nhắc nhở và theo dõi thời gian sử dụng điện thoại',
    desc: 'Kiểm soát thời gian dùng màn hình & cảnh báo khi dùng quá lâu',
    icon: 'timer',
    color: '#8B5CF6',
    route: 'ScreenTime',
    badge: 'Bảo vệ',
    tier: 'free',
  },
  {
    id: 'find_device',
    title: 'Tìm vị trí thiết bị của mình',
    desc: 'Định vị vị trí GPS và phát chuông tìm điện thoại thất lạc',
    icon: 'location',
    color: '#06B6D4',
    route: 'FindDevice',
    badge: 'GPS',
    tier: 'free',
  },
  {
    id: 'clean_photos',
    title: 'Tìm và dọn ảnh trùng lặp',
    desc: 'Quét bộ nhớ, lọc và dọn sạch các ảnh trùng lặp giải phóng dung lượng',
    icon: 'images',
    color: '#EC4899',
    route: 'CleanPhotos',
    badge: 'Dọn rác',
    tier: 'free',
  },
  {
    id: 'fb_multi',
    title: 'Quản lý nhiều tài khoản Facebook',
    desc: 'Lưu phiên đăng nhập và chuyển đổi nhanh giữa các nick Facebook',
    icon: 'logo-facebook',
    color: '#1877F2',
    route: 'FbMulti',
    badge: 'VIP Pro',
    tier: 'vip',
  },
  {
    id: 'ai_reply',
    title: 'AI đọc ngữ cảnh và gợi ý trả lời tin nhắn',
    desc: 'Phân tích ngữ cảnh tin nhắn đến và gợi ý câu trả lời thông minh',
    icon: 'chatbubbles',
    color: '#FFD000',
    route: 'AiReply',
    badge: 'VIP AI',
    tier: 'vip',
  },
];

export function openTool(navigation, tool, user, onUpgradeRequired) {
  if (!tool) return;

  // Kiểm tra quyền truy cập theo vai trò
  if (!canAccessTool(user, tool)) {
    if (typeof onUpgradeRequired === 'function') {
      onUpgradeRequired(tool);
    } else {
      Alert.alert(
        'Yêu cầu VIP',
        `Tiện ích "${tool.title}" là tính năng độc quyền dành cho thành viên VIP. Vui lòng nâng cấp tài khoản để sử dụng.`,
        [{ text: 'Đóng', style: 'cancel' }]
      );
    }
    return;
  }

  // Ghi nhận nhật ký sử dụng lên Firestore
  logToolUsageToFirestore(tool.id, user).catch(() => {});

  if (tool.route) {
    navigation.navigate(tool.route, { tool });
  }
}


