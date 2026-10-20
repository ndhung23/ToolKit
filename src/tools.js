// Danh sách tiện ích. Thêm tiện ích mới = thêm 1 mục ở đây
// + thêm 1 màn hình trong src/navigation/index.js (AppStack)
export const TOOLS = [
  { id: 'pdf', title: 'Ảnh → PDF', desc: 'Ghép nhiều ảnh thành một file PDF', icon: 'document-text', color: '#EF4444', route: 'ImageToPdf', ready: true },
  { id: 'qr', title: 'Quét QR', desc: 'Quét mã QR, mở app ngân hàng', icon: 'qr-code', color: '#10B981', route: 'ComingSoon', ready: false },
  { id: 'transfer', title: 'Chuyển khoản', desc: 'Nhập số tiền, nội dung nhanh', icon: 'card', color: '#F59E0B', route: 'ComingSoon', ready: false },
  { id: 'dup', title: 'Dọn ảnh trùng', desc: 'Tìm và xóa ảnh bị trùng lặp', icon: 'images', color: '#3B82F6', route: 'ComingSoon', ready: false },
  { id: 'ai', title: 'AI trả lời tin nhắn', desc: 'Gợi ý câu trả lời cho Facebook, Zalo', icon: 'chatbubbles', color: '#8B5CF6', route: 'ComingSoon', ready: false },
  { id: 'remind', title: 'Nhắc sử dụng', desc: 'Nhắc khi dùng điện thoại quá lâu', icon: 'alarm', color: '#EC4899', route: 'ComingSoon', ready: false },
  { id: 'find', title: 'Tìm thiết bị', desc: 'Xem vị trí các máy cùng tài khoản', icon: 'location', color: '#06B6D4', route: 'ComingSoon', ready: false },
];

export function openTool(navigation, tool) {
  if (tool.ready) navigation.navigate(tool.route);
  else navigation.navigate('ComingSoon', { tool });
}
