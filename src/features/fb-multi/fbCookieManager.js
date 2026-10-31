import { parseFacebookCookies, PLATFORMS } from './fbAccountStorage';

export const USER_AGENTS = {
  // User-Agent Desktop Safari macOS chuẩn để tương thích 100% với WebKit engine của iOS
  // Tránh triệt để việc bị Zalo WAF phát hiện mismatch giữa Chrome và iOS WebKit
  ZALO_DESKTOP:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  // User-Agent Desktop giúp mở trực tiếp https://www.messenger.com/ không bị ép tải app
  MESSENGER_DESKTOP:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  // User-Agent Mobile cho lướt Facebook
  FACEBOOK_MOBILE:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

/**
 * Script spoofing toàn diện môi trường Desktop Safari trước khi tải trang (injectedJavaScriptBeforeContentLoaded)
 * Giúp Zalo Web và Messenger nhận diện WebView hoàn toàn như trình duyệt Desktop thật:
 * - navigator.platform = 'MacIntel'
 * - navigator.vendor = 'Apple Computer, Inc.' (trùng khớp engine WebKit native của iOS)
 * - navigator.maxTouchPoints = 0
 * - screen.width / height = 1440 / 900
 * @param {string} _platform
 * @returns {string}
 */
export function generateDesktopSpoofScript(_platform = PLATFORMS.ZALO) {
  return `
    (function() {
      try {
        Object.defineProperty(navigator, 'platform', {
          get: function() { return 'MacIntel'; },
          configurable: true
        });
        Object.defineProperty(navigator, 'vendor', {
          get: function() { return 'Apple Computer, Inc.'; },
          configurable: true
        });
        Object.defineProperty(navigator, 'maxTouchPoints', {
          get: function() { return 0; },
          configurable: true
        });
        Object.defineProperty(screen, 'width', {
          get: function() { return 1440; },
          configurable: true
        });
        Object.defineProperty(screen, 'height', {
          get: function() { return 900; },
          configurable: true
        });
        Object.defineProperty(screen, 'availWidth', {
          get: function() { return 1440; },
          configurable: true
        });
        Object.defineProperty(screen, 'availHeight', {
          get: function() { return 900; },
          configurable: true
        });
        Object.defineProperty(navigator, 'webdriver', {
          get: function() { return false; },
          configurable: true
        });
      } catch(e) {}
    })();
    true;
  `;
}

/**
 * Script inject cookie vào WebView trước khi load trang
 * @param {string} cookieStr Chuỗi cookie
 * @param {string} platform Nền tảng (zalo, messenger, facebook)
 * @returns {string}
 */
export function generateCookieInjectionScript(cookieStr, platform = PLATFORMS.ZALO, customUrl = '') {
  if (!cookieStr) return '';

  const parsed = parseFacebookCookies(cookieStr);
  let domainList = ['.zalo.me', 'chat.zalo.me', 'id.zalo.me', 'zalo.me'];
  if (platform === PLATFORMS.FACEBOOK || platform === PLATFORMS.MESSENGER) {
    domainList = ['.facebook.com', 'm.facebook.com', '.messenger.com', 'messenger.com'];
  } else if (platform === PLATFORMS.CUSTOM && customUrl) {
    try {
      const match = customUrl.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/i);
      if (match && match[1]) {
        domainList = [match[1], `.${match[1]}`];
      }
    } catch (_e) {}
  }

  const cookieAssignments = Object.entries(parsed)
    .map(([key, val]) => {
      const sanitizedVal = String(val).replace(/"/g, '\\"');
      return (
        domainList
          .map(
            (d) =>
              `try { document.cookie = "${key}=${sanitizedVal}; path=/; domain=${d}; max-age=31536000; Secure"; } catch(e) {}`
          )
          .join('\n') +
        `\ntry { document.cookie = "${key}=${sanitizedVal}; path=/; max-age=31536000; Secure"; } catch(e) {}`
      );
    })
    .join('\n');

  // Thêm đồng bộ key zpw_sek vào localStorage nếu có
  const zpwSekVal = parsed.zpw_sek ? String(parsed.zpw_sek).replace(/"/g, '\\"') : '';
  const extraLocalStorage = zpwSekVal
    ? `try { localStorage.setItem('zpw_sek', "${zpwSekVal}"); } catch(e) {}`
    : '';

  return `
    (function() {
      try {
        ${cookieAssignments}
        ${extraLocalStorage}
      } catch(err) {}
    })();
    true;
  `;
}

/**
 * Script CSS & DOM tối ưu hóa giao diện Zalo Web & Messenger trên điện thoại:
 * - Tự động thiết lập Viewport meta tag để không bị vỡ layout
 * - Xóa bỏ 100% banner tải app PC của Zalo và màn hình chặn mobile
 * - Tối ưu khung chat tràn viền màn hình
 * @param {string} platform
 * @returns {string}
 */
export function generateMessengerCleanCssScript(platform = PLATFORMS.ZALO) {
  let customCss = '';

  if (platform === PLATFORMS.ZALO) {
    customCss = `
      /* Ẩn triệt để toàn bộ banner đòi tải app PC / app store của Zalo Web */
      .banner-download-app, .zl-banner-app, .download-app-bar, .banner-app-pc,
      div[class*="download-app"], div[class*="banner-download"],
      .popup-download-app, div[id*="download-app"], .banner-install-app,
      div[data-translate-inner="STR_DOWNLOAD_APP_PC"] {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Tối ưu hóa layout Zalo Web vừa vặn màn hình điện thoại */
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background-color: #121214 !important;
        color: #FFFFFF !important;
        overflow-x: hidden !important;
        width: 100% !important;
        height: 100% !important;
      }

      /* Thanh điều hướng chính của Zalo */
      #main-tab, .main-tab {
        background-color: #18181C !important;
      }

      /* Khung danh sách tin nhắn */
      #conversationList, .conv-list {
        background-color: #121214 !important;
      }
    `;
  } else if (platform === PLATFORMS.MESSENGER) {
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

      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background-color: #121214 !important;
        color: #FFFFFF !important;
        overflow-x: hidden !important;
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
      // 1. Tự động thiết lập Viewport meta tag nếu thiếu
      try {
        let meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'viewport';
          document.head.appendChild(meta);
        }
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      } catch(e) {}

      // 2. Chèn CSS làm sạch giao diện
      function applyCleanStyle() {
        try {
          if (!document.getElementById('tk-multi-clean-style')) {
            const style = document.createElement('style');
            style.id = 'tk-multi-clean-style';
            style.innerHTML = "${cleanCss}";
            (document.head || document.documentElement).appendChild(style);
          }

          // Chặn mở app ngoài
          document.querySelectorAll('a[href*="zalo://"], a[href*="fb-messenger:"], a[href*="itms-apps:"]').forEach(function(el) {
            el.removeAttribute('href');
            el.style.display = 'none';
          });
        } catch(e) {}
      }

      applyCleanStyle();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyCleanStyle);
      }
      setInterval(applyCleanStyle, 1200);
    })();
    true;
  `;
}

/**
 * Script cô lập và xóa sạch cookies trước khi mở trang đăng nhập Zalo / Facebook mới
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
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.zalo.me";
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=chat.zalo.me";
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=id.zalo.me";
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.facebook.com";
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=m.facebook.com";
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.messenger.com";
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
 * Script tự động bắt phiên đăng nhập sau khi quét mã QR Zalo hoặc đăng nhập Facebook
 * @param {string} platform Nền tảng đang thêm
 * @param {string[]} existingUids Danh sách các UID đã có sẵn để chống trùng
 * @returns {string}
 */
export function generateAutoDetectSessionScript(platform = PLATFORMS.ZALO, existingUids = []) {
  const existingUidsJson = JSON.stringify(existingUids);

  return `
    (function() {
      let detected = false;
      const existing = ${existingUidsJson};

      window.__tkSaveCurrentSession = function(customName) {
        try {
          const c = document.cookie || '';
          const title = document.title || customName || 'Tài khoản Web';
          const uid = 'web_' + Date.now().toString().slice(-6);
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SESSION_DETECTED',
              platform: '${PLATFORMS.CUSTOM}',
              uid: uid,
              name: customName || title,
              cookies: c,
              avatarUrl: ''
            }));
          }
        } catch(e) {}
      };

      function checkSession() {
        if (detected) return;
        try {
          // Tự động kích hoạt làm mới mã QR nếu phát hiện Zalo báo hết hạn
          const refreshQrBtn = document.querySelector('.btn-refresh-qr, .qr-expired, a[data-translate-inner="STR_REFRESH_QR"]');
          if (refreshQrBtn && typeof refreshQrBtn.click === 'function') {
            refreshQrBtn.click();
          }

          const cookieStr = document.cookie || '';
          const currentUrl = window.location.href || '';

          // 1. XỬ LÝ ZALO: Đã vào chat.zalo.me hoặc có cookie zpw_sek sau khi quét QR / nhập pass
          if ('${platform}' === '${PLATFORMS.ZALO}') {
            const host = window.location.hostname || '';
            const isActualChatDomain = host === 'chat.zalo.me';
            const hasAuthCookies = cookieStr.includes('zpw_sek=') || cookieStr.includes('zsession=');

            // Nếu vẫn đang ở trang đăng nhập id.zalo.me và chưa có cookie xác thực -> Không được kích hoạt sớm!
            if (host.includes('id.zalo.me') && !hasAuthCookies) {
              return;
            }

            if (isActualChatDomain || hasAuthCookies) {
              // Tìm tên Zalo từ giao diện web
              let zaloName = '';
              const nameEl = document.querySelector('.user-profile-name, .nav__tabs__top__avatar, .name-container, div[data-translate-inner="STR_MY_PROFILE"]');
              if (nameEl && nameEl.innerText) {
                zaloName = nameEl.innerText.trim();
              }
              if (!zaloName) {
                const titleEl = document.querySelector('title');
                if (titleEl && titleEl.innerText && !titleEl.innerText.includes('Zalo Web') && !titleEl.innerText.includes('Đăng nhập')) {
                  zaloName = titleEl.innerText.trim();
                }
              }
              if (!zaloName) {
                zaloName = 'Zalo ' + Date.now().toString().slice(-4);
              }

              // Tìm avatar Zalo nếu có
              let avatar = '';
              const avatarEl = document.querySelector('.nav__tabs__top__avatar img, img[src*="avatar.zalo"], img[src*="zalo.me"]');
              if (avatarEl && avatarEl.src) {
                avatar = avatarEl.src;
              }

              // Trích xuất UID Zalo từ cookie hoặc tạo ID duy nhất
              let zaloId = '';
              const uidMatch = cookieStr.match(/zalo_id=([0-9a-zA-Z_]+)/) || cookieStr.match(/zpw_sek=([0-9a-zA-Z_]+)/);
              if (uidMatch && uidMatch[1]) {
                zaloId = uidMatch[1].slice(0, 16);
              } else {
                zaloId = 'zl_' + Date.now().toString().slice(-8);
              }

              if (existing.includes(zaloId)) {
                if (!window._alreadyReportedDuplicate) {
                  window._alreadyReportedDuplicate = true;
                  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'DUPLICATE_ACCOUNT',
                      uid: zaloId
                    }));
                  }
                }
                return;
              }

              detected = true;
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'SESSION_DETECTED',
                  platform: '${PLATFORMS.ZALO}',
                  uid: zaloId,
                  name: zaloName,
                  cookies: cookieStr,
                  avatarUrl: avatar
                }));
              }
            }
          } else {
            // 2. XỬ LÝ FACEBOOK / MESSENGER
            if (cookieStr.includes('c_user=')) {
              const match = cookieStr.match(/c_user=([0-9]+)/);
              if (match && match[1]) {
                const uid = match[1];

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
