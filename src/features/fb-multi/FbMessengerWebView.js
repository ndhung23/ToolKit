import { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme';
import {
  generateCookieInjectionScript,
  generateMessengerCleanCssScript,
} from './fbCookieManager';

export default function FbMessengerWebView({
  account,
  onRefreshSession,
}) {
  const { colors } = useTheme();
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  if (!account || !account.cookies) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.bg }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.sub} />
        <Text style={[styles.emptyText, { color: colors.sub }]}>
          Chưa chọn tài khoản hoặc phiên đăng nhập không tồn tại.
        </Text>
      </View>
    );
  }

  const handleNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
  };

  const handleGoBack = () => {
    if (webViewRef.current && canGoBack) {
      webViewRef.current.goBack();
    }
  };

  const handleGoToChats = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        "window.location.href = 'https://m.facebook.com/messages/'; true;"
      );
    }
  };

  const handleReload = () => {
    setLoading(true);
    setLoadError(false);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
    if (onRefreshSession) {
      onRefreshSession();
    }
  };

  const cookieInjectionScript = generateCookieInjectionScript(account.cookies);
  const cleanCssScript = generateMessengerCleanCssScript();

  return (
    <View style={styles.container}>
      {/* WebView Container */}
      <View style={styles.webWrapper}>
        <WebView
          key={account.id}
          ref={webViewRef}
          source={{ uri: 'https://m.facebook.com/messages/' }}
          injectedJavaScriptBeforeContentLoaded={cookieInjectionScript}
          injectedJavaScript={cleanCssScript}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setLoadError(true);
          }}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          scalesPageToFit={false}
          showsVerticalScrollIndicator={false}
          style={styles.webView}
          userAgent={
            Platform.OS === 'ios'
              ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
              : 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
          }
        />

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingBar}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingBarText, { color: colors.sub }]}>
              Đang tải tin nhắn ({account.nickname || account.name})...
            </Text>
          </View>
        )}

        {/* Màn hình lỗi mạng nếu không tải được */}
        {loadError && (
          <View style={[styles.errorOverlay, { backgroundColor: colors.bg }]}>
            <Ionicons name="cloud-offline-outline" size={44} color="#EF4444" />
            <Text style={[styles.errorTitle, { color: colors.text }]}>Không thể tải tin nhắn</Text>
            <Text style={[styles.errorSub, { color: colors.sub }]}>
              Kiểm tra kết nối mạng hoặc phiên đăng nhập của nick này có thể đã hết hạn.
            </Text>
            <Pressable
              onPress={handleReload}
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="refresh" size={16} color="#121214" />
              <Text style={styles.retryBtnText}>Tải lại trang</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Thanh điều hướng nhanh tiện lợi ở đáy WebView */}
      <View style={[styles.bottomControlBar, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
        <Pressable
          onPress={handleGoBack}
          disabled={!canGoBack}
          style={[styles.controlBtn, !canGoBack && styles.controlBtnDisabled]}
          hitSlop={8}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={canGoBack ? colors.text : colors.sub}
          />
          <Text style={[styles.controlBtnText, { color: canGoBack ? colors.text : colors.sub }]}>
            Quay lại
          </Text>
        </Pressable>

        <Pressable
          onPress={handleGoToChats}
          style={styles.controlBtn}
          hitSlop={8}
        >
          <Ionicons name="chatbubbles" size={20} color={colors.primary} />
          <Text style={[styles.controlBtnText, { color: colors.primary, fontWeight: '700' }]}>
            Hộp thư đến
          </Text>
        </Pressable>

        <Pressable
          onPress={handleReload}
          style={styles.controlBtn}
          hitSlop={8}
        >
          <Ionicons name="reload" size={18} color={colors.text} />
          <Text style={[styles.controlBtnText, { color: colors.text }]}>
            Làm mới
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webWrapper: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#121214',
  },
  loadingBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(18, 18, 20, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 8,
    zIndex: 5,
  },
  loadingBarText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
    zIndex: 10,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  errorSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
    gap: 6,
  },
  retryBtnText: {
    color: '#121214',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  controlBtnDisabled: {
    opacity: 0.4,
  },
  controlBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
