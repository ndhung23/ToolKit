import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const KEY = 'session';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mở app: khôi phục phiên đăng nhập đã lưu
  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        if (raw) setUser(JSON.parse(raw));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      // ĐANG LÀ ĐĂNG NHẬP GIẢ LẬP: chỉ kiểm tra định dạng, chưa có server.
      // Khi có backend (Firebase, Supabase...), thay phần giữa bằng gọi API thật.
      signIn: async (email, password) => {
        await new Promise((r) => setTimeout(r, 600));
        if (!email.includes('@') || password.length < 6) {
          throw new Error('Email không hợp lệ hoặc mật khẩu dưới 6 ký tự.');
        }
        const u = { email, name: email.split('@')[0] };
        await SecureStore.setItemAsync(KEY, JSON.stringify(u));
        setUser(u);
      },
      signOut: async () => {
        await SecureStore.deleteItemAsync(KEY);
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
