import { Alert } from 'react-native';
import { canAccessTool } from './constants/roles';

// Danh sách các tính năng cốt lõi của ToolKit kèm phân quyền (tier: 'free' | 'vip')
export const TOOLS = [
  {
    id: 'fap_exam',
    title: 'Nhắc nhở lịch thi FAP',
    shortTitle: 'Nhắc nhở',
    desc: 'Đăng nhập tài khoản FAP (FeID/Email trường), tự động lấy lịch thi & hẹn giờ nhắc trước',
    icon: 'notifications',
    color: '#F37021',
    route: 'FapExam',
    badge: 'FPT Edu',
    tier: 'free',
  },
  {
    id: 'pdf',
    title: 'Chuyển ảnh thành PDF',
    shortTitle: 'Ghép PDF',
    desc: 'Ghép nhiều ảnh thành một file PDF chất lượng cao',
    icon: 'document-text',
    color: '#EF4444',
    route: 'ImageToPdf',
    badge: 'Sẵn sàng',
    tier: 'free',
  },
  {
    id: 'screentime',
    title: 'Nhắc nhở và theo dõi thời gian sử dụng điện thoại',
    shortTitle: 'Thời gian dùng',
    desc: 'Kiểm soát thời gian dùng màn hình & cảnh báo khi dùng quá lâu',
    icon: 'timer',
    color: '#8B5CF6',
    route: 'ScreenTime',
    badge: 'Bảo vệ',
    tier: 'free',
  },
  {
    id: 'clean_photos',
    title: 'Tìm và dọn ảnh trùng lặp',
    shortTitle: 'Dọn ảnh rác',
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
    shortTitle: 'Đa nick FB',
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
    shortTitle: 'AI Trả lời tin',
    desc: 'Phân tích ngữ cảnh tin nhắn đến và gợi ý câu trả lời thông minh',
    icon: 'chatbubbles',
    color: '#FFD000',
    route: 'AiReply',
    badge: 'VIP AI',
    tier: 'vip',
  },
];

export function openTool(navigation, tool, user, onUpgradeRequired, customTiers = null) {
  if (!tool) return;

  // Kiểm tra quyền truy cập theo vai trò và cấu hình Admin
  if (!canAccessTool(user, tool, customTiers)) {
    if (typeof onUpgradeRequired === 'function') {
      onUpgradeRequired(tool);
    } else {
      if (!user) {
        Alert.alert(
          'Yêu cầu đăng nhập',
          `Tiện ích "${tool.title}" là tính năng VIP. Vui lòng đăng nhập hoặc đăng ký tài khoản để tiếp tục trải nghiệm.`,
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Đăng nhập', onPress: () => navigation?.navigate('Login') },
          ]
        );
      } else {
        Alert.alert(
          'Yêu cầu VIP',
          `Tiện ích "${tool.title}" là tính năng độc quyền dành cho thành viên VIP. Vui lòng liên hệ Quản trị viên để được nâng cấp tài khoản.`,
          [{ text: 'Đóng', style: 'cancel' }]
        );
      }
    }
    return;
  }

  if (tool.route) {
    navigation.navigate(tool.route, { tool });
  }
}


