import { parseFacebookCookies, PLATFORMS } from './fbAccountStorage';

export const USER_AGENTS = {
  // User-Agent Desktop giúp bypass hoàn toàn màn hình "Chuyển sang Messenger" của Meta
  MESSENGER_DESKTOP:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  // User-Agent Mobile cho lướt Facebook mượt mà
  FACEBOOK_MOBILE:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  // User-Agent cho Zalo Web (chat.zalo.me yêu cầu Desktop/Chrome để nạp giao diện chat đầy đủ)
  ZALO_WEB:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

/**
 * Script inject cookie vào WebView trước khi load trang
 * @param {string} cookieStr Chuỗi cookie
 * @param {string} platform Nền tảng (facebook, messenger, zalo)
 * @returns {string}
 */
export function generateCookieInjectionScript(cookieStr, platform = PLATFORMS.MESSENGER) {
  if (!cookieStr) return '';

  const parsed = parseFacebookCookies(cookieStr);
  let domainList = ['.facebook.com', 'm.facebook.com', '.messenger.com'];
  if (platform === PLATFORMS.ZALO) {
    domainList = ['.zalo.me', 'chat.zalo.me', 'id.zalo.me'];
  }

  const cookieAssignments = Object.entries(parsed)
    .map(([key, val]) => {
      const sanitizedVal = String(val).replace(/"/g, '\\"');
      return domainList
        .map(
          (d) =>
            `try { document.cookie = "${key}=${sanitizedVal}; path=/; domain=${d}; max-age=31536000; SameSite=Lax; Secure"; } catch(e) {}`
        )
        .join('\n') + `\ntry { document.cookie = "${key}=${sanitizedVal}; path=/; max-age=31536000; SameSite=Lax; Secure"; } catch(e) {}`;
    })
    .join('\n');

  return `
    (function() {
      try {
        ${cookieAssignments}
      } catch(err) {}
    })();
    true;
  `;
}

/**
 * Script CSS & DOM làm sạch giao diện và xóa bỏ màn hình chặn "Chuyển sang Messenger"
 * @param {string} platform
 * @returns {string}
 */
export function generateMessengerCleanCssScript(platform = PLATFORMS.MESSENGER) {
  let customCss = '';

  if (platform === PLATFORMS.MESSENGER) {
    customCss = `
      /* Ẩn triệt để màn hình chặn "Chuyển sang Messenger" của Facebook */
      div[data-sigil*="upsell"], div[class*="upsell"], div[id*="upsell"],
      div[aria-label*="Messenger"], div[data-sigil*="app-upsell"],
      div[role="dialog"]:has(a[href*="messenger.com"]),
      div:has(> img[src*="messenger"]),
      div:has(> svg[aria-label*="Messenger"]),
      a[href*="fb-messenger://"], a[href*="itms-apps://"], a[href*="apps.apple.com"],
      div._8s_a, div._8s_b, div._7whw, div._8e3c, div._97w9 {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Ẩn header Facebook rườm rà */
      header, #header, div[role="banner"], div[data-sigil="m-header"],
      #m_common_header, .m-header {
        display: none !important;
      }

      /* Cho phép scroll và hiển thị nội dung chat tràn viền */
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background-color: #121214 !important;
        color: #FFFFFF !important;
        overflow-x: hidden !important;
      }
    `;
  } else if (platform === PLATFORMS.ZALO) {
    customCss = `
      /* Ẩn các banner tải app của Zalo Web */
      .banner-download-app, .zl-banner-app, .download-app-bar {
        display: none !important;
      }
      body {
        background-color: #121214 !important;
      }
    `;
  } else {
    // Facebook
    customCss = `
      header, #header, div[role="banner"], div[data-sigil="m-header"] {
        display: none !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background-color: #121214 !important;
      }
    `;
  }

  const cleanCss = customCss.replace(/\s+/g, ' ');

  return `
    (function() {
      function applyCleanStyle() {
        try {
          if (!document.getElementById('tk-multi-clean-style')) {
            const style = document.createElement('style');
            style.id = 'tk-multi-clean-style';
            style.innerHTML = "${cleanCss}";
            (document.head || document.documentElement).appendChild(style);
          }

          // Tự động chặn các click vào link mở app ngoài
          document.querySelectorAll('a[href*="fb-messenger:"], a[href*="itms-apps:"]').forEach(function(el) {
            el.removeAttribute('href');
            el.style.display = 'none';
          });
        } catch(e) {}
      }

      applyCleanStyle();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyCleanStyle);
      }
      setInterval(applyCleanStyle, 1500);
    })();
    true;
  `;
}

/**
 * Script cô lập và xóa sạch cookies trước khi mở trang đăng nhập tài khoản mới
 * @returns {string}
 */
export function generateCleanCookiesBeforeLoginScript() {
  return `
    (function() {
      try {
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i];
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          if (name) {
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.facebook.com";
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=m.facebook.com";
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.messenger.com";
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.zalo.me";
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          }
        }
        try { localStorage.clear(); } catch(e) {}
        try { sessionStorage.clear(); } catch(e) {}
      } catch(err) {}
    })();
    true;
  `;
}

/**
 * Script tự động phát hiện phiên đăng nhập mới trong modal thêm nick
 * @param {string} platform Nền tảng đang thêm
 * @param {string[]} existingUids Danh sách các UID đã có sẵn để chống trùng
 * @returns {string}
 */
export function generateAutoDetectSessionScript(platform = PLATFORMS.MESSENGER, existingUids = []) {
  const existingUidsJson = JSON.stringify(existingUids);

  return `
    (function() {
      let detected = false;
      const existing = ${existingUidsJson};

      function checkSession() {
        if (detected) return;
        try {
          const cookieStr = document.cookie || '';
          const currentUrl = window.location.href || '';

          if ('${platform}' === '${PLATFORMS.ZALO}') {
            // Kiểm tra Zalo Web: Đã vào chat.zalo.me hoặc có cookie zpw_sek
            if (currentUrl.includes('chat.zalo.me') || cookieStr.includes('zpw_sek=') || cookieStr.includes('zsession=')) {
              detected = true;
              let zaloName = 'Zalo User';
              const nameEl = document.querySelector('.user-profile-name, .nav__tabs__top__avatar, .name-container');
              if (nameEl && nameEl.innerText) {
                zaloName = nameEl.innerText.trim();
              }
              const zaloId = 'zalo_' + Date.now().toString().slice(-6);

              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'SESSION_DETECTED',
                  platform: '${PLATFORMS.ZALO}',
                  uid: zaloId,
                  name: zaloName,
                  cookies: cookieStr,
                  avatarUrl: ''
                }));
              }
            }
          } else {
            // Facebook / Messenger
            if (cookieStr.includes('c_user=')) {
              const match = cookieStr.match(/c_user=([0-9]+)/);
              if (match && match[1]) {
                const uid = match[1];

                // Nếu tài khoản này đã có trong danh sách -> Báo cho React Native biết để cảnh báo
                if (existing.includes(uid)) {
                  if (!window._alreadyReportedDuplicate) {
                    window._alreadyReportedDuplicate = true;
                    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'DUPLICATE_ACCOUNT',
                        uid: uid
                      }));
                    }
                  }
                  return;
                }

                detected = true;
                let userName = '';
                const titleEl = document.querySelector('title');
                if (titleEl && titleEl.innerText) {
                  const t = titleEl.innerText.trim();
                  if (t && !t.toLowerCase().includes('facebook') && !t.toLowerCase().includes('đăng nhập')) {
                    userName = t;
                  }
                }
                if (!userName) {
                  userName = '${platform === PLATFORMS.MESSENGER ? 'Messenger' : 'Facebook'} ' + uid.slice(-4);
                }

                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'SESSION_DETECTED',
                    platform: '${platform}',
                    uid: uid,
                    name: userName,
                    cookies: cookieStr,
                    avatarUrl: 'https://graph.facebook.com/' + uid + '/picture?type=large'
                  }));
                }
              }
            }
          }
        } catch(e) {}
      }

      checkSession();
      setInterval(checkSession, 1200);
      window.addEventListener('load', checkSession);
    })();
    true;
  `;
}
