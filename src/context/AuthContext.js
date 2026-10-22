import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ROLES, DEMO_ACCOUNTS } from '../constants/roles';
import {
  isFirebaseConfigured,
  firebaseSignIn,
  firebaseSignOut,
  saveUserToFirestore,
  getUserFromFirestore,
  updateUserRoleInFirestore,
} from '../services/firebase';

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
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!parsed.role) parsed.role = ROLES.FREE;

          // Nếu có uid và Firebase sẵn sàng, đồng bộ role mới nhất từ Firestore
          if (parsed.uid && isFirebaseConfigured()) {
            try {
              const remoteProfile = await getUserFromFirestore(parsed.uid);
              if (remoteProfile && remoteProfile.role) {
                parsed.role = remoteProfile.role;
                if (remoteProfile.name) parsed.name = remoteProfile.name;
              }
            } catch {}
          }

          setUser(parsed);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      roles: ROLES,
      demoAccounts: DEMO_ACCOUNTS,
      isFirebaseReady: isFirebaseConfigured(),
      isVip: user?.role === ROLES.VIP || user?.role === ROLES.ADMIN,
      isAdmin: user?.role === ROLES.ADMIN,

      // Đăng nhập (Hỗ trợ Firebase Auth + Firestore hoặc Fallback Mock)
      signIn: async (email, password = 'password123', roleOverride = null) => {
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanEmail.includes('@') || (password && password.length < 6)) {
          throw new Error('Email không hợp lệ hoặc mật khẩu dưới 6 ký tự.');
        }

        let role = roleOverride;
        if (!role) {
          if (cleanEmail.includes('admin')) {
            role = ROLES.ADMIN;
          } else if (cleanEmail.includes('vip')) {
            role = ROLES.VIP;
          } else {
            role = ROLES.FREE;
          }
        }

        const namePart = email.split('@')[0];
        const formattedName =
          role === ROLES.ADMIN
            ? 'Quản trị viên'
            : role === ROLES.VIP
            ? 'VIP ' + namePart
            : namePart;

        let uid = 'local_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

        // Thử kết nối Firebase Auth & Firestore nếu có cấu hình
        if (isFirebaseConfigured()) {
          try {
            const fbUser = await firebaseSignIn(cleanEmail, password);
            if (fbUser) {
              uid = fbUser.uid;
              const remoteData = await getUserFromFirestore(uid);
              if (remoteData?.role) {
                role = remoteData.role;
              } else {
                await saveUserToFirestore(uid, {
                  email: cleanEmail,
                  name: formattedName,
                  role,
                });
              }
            }
          } catch (e) {
            console.log('[Auth] Đăng nhập Firebase Auth không thành công, tiếp tục với Fallback Session');
          }
        }

        const u = {
          uid,
          email: cleanEmail,
          name: formattedName,
          role,
        };

        // Lưu bản ghi vào Firestore nếu có thể
        saveUserToFirestore(uid, {
          email: cleanEmail,
          name: formattedName,
          role,
        }).catch(() => {});

        await SecureStore.setItemAsync(KEY, JSON.stringify(u));
        setUser(u);
        return u;
      },

      // Đăng nhập nhanh với tài khoản Demo 1-chạm (Có lưu Firestore)
      signInDemo: async (demoAccount) => {
        const uid = 'demo_' + demoAccount.role;
        const u = {
          uid,
          email: demoAccount.email,
          name: demoAccount.name,
          role: demoAccount.role,
        };

        // Ghi nhận lên Firestore nếu online
        saveUserToFirestore(uid, {
          email: demoAccount.email,
          name: demoAccount.name,
          role: demoAccount.role,
        }).catch(() => {});

        await SecureStore.setItemAsync(KEY, JSON.stringify(u));
        setUser(u);
        return u;
      },

      // Nâng cấp trực tiếp lên VIP (Đồng bộ Firestore + Local)
      upgradeToVip: async () => {
        if (!user) return;
        const updated = {
          ...user,
          role: ROLES.VIP,
        };
        if (user.uid) {
          updateUserRoleInFirestore(user.uid, ROLES.VIP).catch(() => {});
        }
        await SecureStore.setItemAsync(KEY, JSON.stringify(updated));
        setUser(updated);
        return updated;
      },

      // Chuyển đổi vai trò nhanh (Đồng bộ Firestore + Local)
      switchRole: async (newRole) => {
        if (!user) return;
        const updated = {
          ...user,
          role: newRole,
        };
        if (user.uid) {
          updateUserRoleInFirestore(user.uid, newRole).catch(() => {});
        }
        await SecureStore.setItemAsync(KEY, JSON.stringify(updated));
        setUser(updated);
        return updated;
      },

      // Đăng xuất
      signOut: async () => {
        await firebaseSignOut();
        await SecureStore.deleteItemAsync(KEY);
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);


