import { parseFacebookCookies } from './fbAccountStorage';

/**
 * Tạo script JavaScript để inject cookie của tài khoản vào WebView trước khi load trang
 * @param {string} cookieStr Chuỗi cookie của tài khoản
 * @returns {string}
 */
export function generateCookieInjectionScript(cookieStr) {
  if (!cookieStr) return '';

  const parsed = parseFacebookCookies(cookieStr);
  const cookieAssignments = Object.entries(parsed)
    .map(([key, val]) => {
      // Thiết lập cookie cho cả .facebook.com và domain hiện tại
      return `
        try {
          document.cookie = "${key}=${val}; path=/; domain=.facebook.com; max-age=31536000; SameSite=Lax; Secure";
          document.cookie = "${key}=${val}; path=/; domain=m.facebook.com; max-age=31536000; SameSite=Lax; Secure";
          document.cookie = "${key}=${val}; path=/; max-age=31536000; SameSite=Lax; Secure";
        } catch(e) {}
      `;
    })
    .join('\n');

  return `
    (function() {
      try {
        ${cookieAssignments}
      } catch(err) {
        console.error('Error injecting cookies:', err);
      }
    })();
    true;
  `;
}

/**
 * Tạo mã CSS và script làm sạch giao diện web Facebook/Messenger:
 * - Ẩn header Facebook chung (logo, chuông thông báo, menu 3 gạch).
 * - Ẩn thanh bottom bar của Facebook.
 * - Ẩn toàn bộ popup đòi cài đặt app Messenger (Install Messenger / Open in app).
 * - Tối ưu khung chat tràn viền màn hình và mượt mà.
 * @returns {string}
 */
export function generateMessengerCleanCssScript() {
  const css = `
    /* Ẩn header xanh và thanh menu rườm rà của Facebook */
    header, #header, div[role="banner"], div[data-sigil="m-header"],
    #m_common_header, .m-header, div[id*="header"] {
      display: none !important;
    }

    /* Ẩn banner quảng cáo / đòi cài đặt app Messenger */
    div[data-sigil*="upsell"], div[class*="upsell"], div[id*="upsell"],
    div[aria-label*="Messenger"], div[data-sigil*="app-upsell"],
    a[href*="market://"], a[href*="play.google.com"], a[href*="apps.apple.com"],
    div[role="dialog"] button:has(+ div:contains("Messenger")) {
      display: none !important;
    }

    /* Ẩn footer và thanh điều hướng dưới của FB */
    footer, #footer, div[role="contentinfo"], div[data-sigil="m-footer"] {
      display: none !important;
    }

    /* Tối ưu hóa layout toàn màn hình */
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #121214 !important;
      color: #FFFFFF !important;
      -webkit-tap-highlight-color: transparent !important;
      overflow-x: hidden !important;
    }

    /* Khung chat và danh sách tin nhắn */
    #root, #viewport, #m_messages_thread_list, div[role="main"] {
      width: 100% !important;
      max-width: 100% !important;
      padding-top: 0 !important;
      margin-top: 0 !important;
    }
  `.replace(/\s+/g, ' ');

  return `
    (function() {
      function applyCleanLayout() {
        try {
          if (!document.getElementById('fb-messenger-clean-style')) {
            const style = document.createElement('style');
            style.id = 'fb-messenger-clean-style';
            style.innerHTML = "${css}";
            (document.head || document.documentElement).appendChild(style);
          }

          // Tự động đóng các popup mời cài app Messenger nếu xuất hiện
          const closeButtons = document.querySelectorAll('button[aria-label="Đóng"], button[aria-label="Close"], [data-sigil="touchable"]');
          closeButtons.forEach(btn => {
            const text = (btn.innerText || '').toLowerCase();
            if (text.includes('lúc khác') || text.includes('not now') || text.includes('tiếp tục trên web') || text.includes('stay on web')) {
              btn.click();
            }
          });
        } catch(e) {}
      }

      applyCleanLayout();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyCleanLayout);
      }
      setInterval(applyCleanLayout, 1500);
    })();
    true;
  `;
}

/**
 * Tạo script tự động phát hiện phiên đăng nhập Facebook thành công trong Login WebView:
 * - Theo dõi document.cookie để tìm c_user (Facebook UID).
 * - Khi có c_user, trích xuất cookie đầy đủ và tên hiển thị.
 * - Gửi tin nhắn về React Native qua window.ReactNativeWebView.postMessage.
 * @returns {string}
 */
export function generateAutoDetectSessionScript() {
  return `
    (function() {
      let detected = false;

      function checkSession() {
        if (detected) return;
        try {
          const cookieStr = document.cookie || '';
          if (cookieStr.includes('c_user=')) {
            const match = cookieStr.match(/c_user=([0-9]+)/);
            if (match && match[1]) {
              detected = true;
              const uid = match[1];

              // Cố gắng tìm tên hiển thị người dùng từ tiêu đề hoặc DOM
              let userName = '';
              const titleEl = document.querySelector('title');
              if (titleEl && titleEl.innerText) {
                const titleText = titleEl.innerText.trim();
                if (titleText && !titleText.toLowerCase().includes('facebook') && !titleText.toLowerCase().includes('đăng nhập')) {
                  userName = titleText;
                }
              }

              if (!userName) {
                const profileLinks = document.querySelectorAll('a[href*="/me"], a[href*="/profile.php"]');
                for (let i = 0; i < profileLinks.length; i++) {
                  const text = (profileLinks[i].innerText || '').trim();
                  if (text && text.length > 1 && !text.includes('Profile') && !text.includes('Trang cá nhân')) {
                    userName = text;
                    break;
                  }
                }
              }

              if (!userName) {
                userName = 'Facebook UID ' + uid;
              }

              const payload = {
                type: 'FB_SESSION_DETECTED',
                uid: uid,
                name: userName,
                cookies: cookieStr,
                avatarUrl: 'https://graph.facebook.com/' + uid + '/picture?type=large'
              };

              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify(payload));
              }
            }
          }
        } catch(err) {
          console.error('Error detecting session:', err);
        }
      }

      checkSession();
      const interval = setInterval(checkSession, 1000);
      window.addEventListener('load', checkSession);
    })();
    true;
  `;
}
