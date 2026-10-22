// src/i18n/translations.js
// Từ điển đa ngôn ngữ (Tiếng Việt & English) cho toàn bộ ứng dụng ToolKit

export const translations = {
  vi: {
    // Điều hướng (Navigation)
    nav: {
      home: 'Trang chủ',
      tools: 'Tiện ích',
      stats: 'Thống kê',
      settings: 'Cài đặt',
      homeTitle: 'Trang chủ ToolKit',
      admin: 'Quản trị hệ thống',
      settingsDrawer: 'Cài đặt hệ thống',
      login: 'Đăng nhập',
      register: 'Đăng ký',
    },

    // Màn hình Cài đặt (Settings)
    settings: {
      title: 'Cài đặt hệ thống',
      subtitle: 'Phiên bản 1.0.0 (Derot Edition)',
      guest: 'Khách trải nghiệm',
      notLoggedIn: 'Chưa đăng nhập tài khoản',
      login: 'Đăng nhập',
      register: 'Tạo tài khoản mới',
      registerBtn: 'Đăng ký',
      adminPanel: 'Trang Quản trị viên (Admin Panel)',
      openNow: 'Mở ngay',
      roleNote: 'Cấp bậc tài khoản do Quản trị viên hệ thống quản lý và phân quyền.',
      logout: 'Đăng xuất tài khoản',
      logoutConfirmTitle: 'Đăng xuất',
      logoutConfirmMsg: 'Bạn muốn đăng xuất khỏi tài khoản?',
      cancel: 'Hủy',
      confirm: 'Xác nhận',

      // Tùy chọn Giao diện & Ngôn ngữ
      sectionPreferences: 'Giao diện & Ngôn ngữ',
      theme: 'Chế độ giao diện',
      darkTheme: 'Giao diện Tối',
      lightTheme: 'Giao diện Sáng',
      darkThemeDesc: 'Tối matte & Vàng rực',
      lightThemeDesc: 'Sáng thanh lịch & Hiện đại',
      themeSwitchNotice: 'Chuyển sang',

      language: 'Ngôn ngữ ứng dụng',
      langVi: 'Tiếng Việt',
      langEn: 'English',
      langSelectedVi: 'Tiếng Việt 🇻🇳',
      langSelectedEn: 'English 🇬🇧',

      // Tùy chọn ứng dụng khác
      sectionAppOptions: 'Tùy chọn ứng dụng',
      sound: 'Âm thanh chuông báo',
      soundValue: 'Bật',
      reminder: 'Nhắc nhở sử dụng',
      reminderValue: 'Mỗi 45 phút',
      protection: 'Chế độ bảo vệ',
      protectionValue: 'Nghiêm ngặt',
      footerNote: 'Hệ thống bảo mật và phân quyền vai trò (RBAC) tiêu chuẩn.',
    },

    // Màn hình chính (HomeScreen)
    home: {
      greetingMorning: 'Chào buổi sáng,',
      greetingAfternoon: 'Chào buổi chiều,',
      greetingEvening: 'Chào buổi tối,',
      guest: 'Khách',
      toolsReadyBadge: '8 công cụ đã sẵn sàng',
      reorder: 'Đổi vị trí',
      doneReorder: 'Xong',
      accessibleCount: 'Khả dụng {accessible}/{total}',
      vipUnlocked: 'Đã mở khóa toàn bộ',
      upgradeVip: 'Nâng cấp VIP',
      recentTitle: 'Tiện ích thường dùng',
      allToolsTitle: 'Tất cả tiện ích hệ thống',
      searchPlaceholder: 'Tìm kiếm nhanh công cụ...',
      resetOrder: 'Đặt lại mặc định',
    },

    // Phân quyền & Vai trò
    roles: {
      admin: 'Quản trị viên',
      vip: 'Thành viên VIP',
      free: 'Thành viên Thường',
      adminBadge: 'ADMIN',
      vipBadge: 'VIP GOLD',
      freeBadge: 'FREE',
    },

    // Thông báo mở tiện ích
    toolAccess: {
      loginRequiredTitle: 'Yêu cầu đăng nhập',
      loginRequiredMsg: 'Tiện ích "{title}" là tính năng VIP. Vui lòng đăng nhập hoặc đăng ký tài khoản để tiếp tục trải nghiệm.',
      vipRequiredTitle: 'Yêu cầu VIP',
      vipRequiredMsg: 'Tiện ích "{title}" là tính năng độc quyền dành cho thành viên VIP. Vui lòng liên hệ Quản trị viên để được nâng cấp tài khoản.',
      close: 'Đóng',
      later: 'Để sau',
      loginBtn: 'Đăng nhập',
    },

    // Công cụ hệ thống (8 tools)
    tools: {
      pdf: {
        title: 'Chuyển ảnh thành PDF',
        shortTitle: 'Ghép PDF',
        desc: 'Ghép nhiều ảnh thành một file PDF chất lượng cao',
        badge: 'Sẵn sàng',
      },
      autoclick: {
        title: 'Auto Click — tự động chạm màn hình',
        shortTitle: 'Auto Click',
        desc: 'Tự động chạm màn hình theo chu kỳ & vị trí cài đặt',
        badge: 'VIP Pro',
      },
      qr_transfer: {
        title: 'Hỗ trợ chuyển khoản bằng QR',
        shortTitle: 'Chuyển QR',
        desc: 'Quét QR → nhập tiền, note → Chuyển qua ngân hàng để hoàn thành',
        badge: 'Tiện lợi',
      },
      screentime: {
        title: 'Nhắc nhở và theo dõi thời gian sử dụng điện thoại',
        shortTitle: 'Thời gian dùng',
        desc: 'Kiểm soát thời gian dùng màn hình & cảnh báo khi dùng quá lâu',
        badge: 'Bảo vệ',
      },
      find_device: {
        title: 'Tìm vị trí thiết bị của mình',
        shortTitle: 'Tìm thiết bị',
        desc: 'Định vị vị trí GPS và phát chuông tìm điện thoại thất lạc',
        badge: 'GPS',
      },
      clean_photos: {
        title: 'Tìm và dọn ảnh trùng lặp',
        shortTitle: 'Dọn ảnh rác',
        desc: 'Quét bộ nhớ, lọc và dọn sạch các ảnh trùng lặp giải phóng dung lượng',
        badge: 'Dọn rác',
      },
      fb_multi: {
        title: 'Quản lý nhiều tài khoản Facebook',
        shortTitle: 'Đa nick FB',
        desc: 'Lưu phiên đăng nhập và chuyển đổi nhanh giữa các nick Facebook',
        badge: 'VIP Pro',
      },
      ai_reply: {
        title: 'AI đọc ngữ cảnh và gợi ý trả lời tin nhắn',
        shortTitle: 'AI Trả lời tin',
        desc: 'Phân tích ngữ cảnh tin nhắn đến và gợi ý câu trả lời thông minh',
        badge: 'VIP AI',
      },
    },

    // Chung (Common)
    common: {
      save: 'Lưu',
      close: 'Đóng',
      cancel: 'Hủy',
      confirm: 'Xác nhận',
      back: 'Quay lại',
      loading: 'Đang tải...',
      success: 'Thành công',
      error: 'Lỗi',
    },
  },

  en: {
    // Navigation
    nav: {
      home: 'Home',
      tools: 'Tools',
      stats: 'Stats',
      settings: 'Settings',
      homeTitle: 'ToolKit Home',
      admin: 'System Admin',
      settingsDrawer: 'System Settings',
      login: 'Sign In',
      register: 'Sign Up',
    },

    // Settings Screen
    settings: {
      title: 'System Settings',
      subtitle: 'Version 1.0.0 (Derot Edition)',
      guest: 'Guest Explorer',
      notLoggedIn: 'Not signed in',
      login: 'Sign In',
      register: 'Create New Account',
      registerBtn: 'Sign Up',
      adminPanel: 'Admin Panel',
      openNow: 'Open',
      roleNote: 'Account tiers and access permissions are managed by system administrators.',
      logout: 'Sign Out',
      logoutConfirmTitle: 'Sign Out',
      logoutConfirmMsg: 'Are you sure you want to sign out?',
      cancel: 'Cancel',
      confirm: 'Confirm',

      // Appearance & Language options
      sectionPreferences: 'Appearance & Language',
      theme: 'Theme Mode',
      darkTheme: 'Dark Theme',
      lightTheme: 'Light Theme',
      darkThemeDesc: 'Matte Black & Electric Gold',
      lightThemeDesc: 'Clean Light & Minimalist',
      themeSwitchNotice: 'Switch to',

      language: 'App Language',
      langVi: 'Tiếng Việt',
      langEn: 'English',
      langSelectedVi: 'Tiếng Việt 🇻🇳',
      langSelectedEn: 'English 🇬🇧',

      // Other options
      sectionAppOptions: 'App Preferences',
      sound: 'Alarm Ringtone',
      soundValue: 'On',
      reminder: 'Usage Reminder',
      reminderValue: 'Every 45 mins',
      protection: 'Security Mode',
      protectionValue: 'Strict',
      footerNote: 'Standard Role-Based Access Control (RBAC) & security architecture.',
    },

    // Home Screen
    home: {
      greetingMorning: 'Good morning,',
      greetingAfternoon: 'Good afternoon,',
      greetingEvening: 'Good evening,',
      guest: 'Guest',
      toolsReadyBadge: '8 tools ready to use',
      reorder: 'Reorder',
      doneReorder: 'Done',
      accessibleCount: 'Accessible {accessible}/{total}',
      vipUnlocked: 'All Tools Unlocked',
      upgradeVip: 'Upgrade VIP',
      recentTitle: 'Frequent Tools',
      allToolsTitle: 'All System Utilities',
      searchPlaceholder: 'Quick search tools...',
      resetOrder: 'Reset Order',
    },

    // Roles & Badges
    roles: {
      admin: 'Administrator',
      vip: 'VIP Member',
      free: 'Free Member',
      adminBadge: 'ADMIN',
      vipBadge: 'VIP GOLD',
      freeBadge: 'FREE',
    },

    // Tool Access Dialogs
    toolAccess: {
      loginRequiredTitle: 'Sign In Required',
      loginRequiredMsg: 'The utility "{title}" is a VIP feature. Please sign in or create an account to proceed.',
      vipRequiredTitle: 'VIP Required',
      vipRequiredMsg: 'The utility "{title}" is exclusive to VIP members. Please contact an Administrator to upgrade your account.',
      close: 'Close',
      later: 'Later',
      loginBtn: 'Sign In',
    },

    // Tools
    tools: {
      pdf: {
        title: 'Image to PDF Converter',
        shortTitle: 'Image PDF',
        desc: 'Merge multiple images into a high-quality PDF document',
        badge: 'Ready',
      },
      autoclick: {
        title: 'Auto Click — Screen Auto Tapper',
        shortTitle: 'Auto Click',
        desc: 'Automatically tap on screen with custom cycles and positions',
        badge: 'VIP Pro',
      },
      qr_transfer: {
        title: 'QR Code Bank Transfer Assistant',
        shortTitle: 'QR Transfer',
        desc: 'Scan QR → input amount & note → transfer seamlessly to bank',
        badge: 'Convenient',
      },
      screentime: {
        title: 'Screen Time & Digital Wellbeing Tracker',
        shortTitle: 'Screen Time',
        desc: 'Monitor screen usage duration and receive over-usage alerts',
        badge: 'Protection',
      },
      find_device: {
        title: 'Find My Lost Device',
        shortTitle: 'Find Device',
        desc: 'Locate device via GPS and sound alarm to find misplaced phone',
        badge: 'GPS',
      },
      clean_photos: {
        title: 'Duplicate Photo Cleaner',
        shortTitle: 'Clean Photos',
        desc: 'Scan storage, identify and purge duplicate photos safely',
        badge: 'Clean Up',
      },
      fb_multi: {
        title: 'Multi-Account Facebook Manager',
        shortTitle: 'Multi FB',
        desc: 'Store login sessions and switch fast between multiple profiles',
        badge: 'VIP Pro',
      },
      ai_reply: {
        title: 'Smart Context AI Message Assistant',
        shortTitle: 'AI Reply',
        desc: 'Analyze conversation context and suggest smart quick replies',
        badge: 'VIP AI',
      },
    },

    // Common
    common: {
      save: 'Save',
      close: 'Close',
      cancel: 'Cancel',
      confirm: 'Confirm',
      back: 'Back',
      loading: 'Loading...',
      success: 'Success',
      error: 'Error',
    },
  },
};
