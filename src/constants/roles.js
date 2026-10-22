// src/constants/roles.js
// Định nghĩa vai trò (RBAC) và danh sách tài khoản demo cho đồ án ToolKit

export const ROLES = {
  FREE: 'free',
  VIP: 'vip',
  ADMIN: 'admin',
};

// Cấu hình nhãn & màu sắc cho từng vai trò theo phong cách Derot
export const ROLE_CONFIG = {
  [ROLES.ADMIN]: {
    label: 'ADMIN',
    name: 'Quản trị viên',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.35)',
    icon: 'shield-checkmark',
  },
  [ROLES.VIP]: {
    label: 'VIP GOLD',
    name: 'Thành viên VIP',
    color: '#FFD000',
    bg: 'rgba(255, 208, 0, 0.15)',
    border: 'rgba(255, 208, 0, 0.35)',
    icon: 'crown',
  },
  [ROLES.FREE]: {
    label: 'FREE',
    name: 'Thành viên Thường',
    color: '#9E9EA7',
    bg: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.15)',
    icon: 'person',
  },
};

// Danh sách tài khoản demo 1-chạm (Dùng cho giảng viên & kiểm thử)
export const DEMO_ACCOUNTS = [
  {
    role: ROLES.ADMIN,
    email: 'admin@toolkit.com',
    name: 'Admin Quản Trị',
    desc: 'Toàn quyền hệ thống + Trang Quản trị',
  },
  {
    role: ROLES.VIP,
    email: 'vip@toolkit.com',
    name: 'Người dùng VIP',
    desc: 'Mở khóa toàn bộ 8/8 tiện ích',
  },
  {
    role: ROLES.FREE,
    email: 'user@toolkit.com',
    name: 'Người dùng Thường',
    desc: 'Dùng 5 tiện ích cơ bản, khóa 3 VIP',
  },
];

// Helper kiểm tra quyền truy cập công cụ
export function canAccessTool(user, tool) {
  if (!tool) return false;
  // Nếu công cụ không yêu cầu VIP hoặc người dùng là VIP / ADMIN -> Được truy cập
  if (tool.tier !== 'vip') return true;
  return user?.role === ROLES.VIP || user?.role === ROLES.ADMIN;
}

export function isVip(user) {
  return user?.role === ROLES.VIP || user?.role === ROLES.ADMIN;
}

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN;
}
