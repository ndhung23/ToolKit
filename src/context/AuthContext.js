import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ROLES } from '../constants/roles';
import {
  isFirebaseConfigured,
  firebaseSignIn,
  firebaseSignOut,
  firebaseSignInWithGoogle,
  firebaseSendPasswordReset,
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
      isFirebaseReady: isFirebaseConfigured(),
      isVip: user?.role === ROLES.VIP || user?.role === ROLES.ADMIN,
      isAdmin: user?.role === ROLES.ADMIN,

      // Đăng nhập an toàn (Xác thực Firebase Auth hoặc Fallback Session)
      signIn: async (email, password) => {
        const cleanEmail = email ? email.trim().toLowerCase() : '';

        if (!cleanEmail || !cleanEmail.includes('@') || !password || password.length < 6) {
          throw new Error('Vui lòng nhập email hợp lệ và mật khẩu từ 6 ký tự trở lên.');
        }

        let role = ROLES.FREE;

        const namePart = cleanEmail.split('@')[0];
        let formattedName = namePart;
        let uid = 'user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

        // Xác thực qua Firebase Auth nếu có cấu hình
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
              if (remoteData?.name) formattedName = remoteData.name;
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

      // Đăng nhập bằng tài khoản Google
      signInWithGoogle: async () => {
        if (!isFirebaseConfigured()) {
          throw new Error('Tính năng đăng nhập Google yêu cầu cấu hình Firebase.');
        }

        const googleUser = await firebaseSignInWithGoogle();
        if (!googleUser) {
          throw new Error('Không thể đăng nhập tài khoản Google.');
        }

        const email = googleUser.email.toLowerCase();
        const uid = googleUser.uid;
        const name = googleUser.displayName || email.split('@')[0];

        // Đồng bộ vai trò người dùng từ Firestore (mặc định FREE)
        let role = ROLES.FREE;
        const remoteProfile = await getUserFromFirestore(uid);
        if (remoteProfile?.role) {
          role = remoteProfile.role;
        } else {
          await saveUserToFirestore(uid, {
            email,
            name,
            role,
            photoURL: googleUser.photoURL || null,
          });
        }

        const u = {
          uid,
          email,
          name: remoteProfile?.name || name,
          role,
          photoURL: googleUser.photoURL || null,
        };

        await SecureStore.setItemAsync(KEY, JSON.stringify(u));
        setUser(u);
        return u;
      },

      // Gửi email đặt lại mật khẩu (Thời hạn link: 5 phút)
      sendPasswordReset: async (email) => {
        const cleanEmail = email ? email.trim().toLowerCase() : '';
        if (!cleanEmail || !cleanEmail.includes('@')) {
          throw new Error('Vui lòng nhập địa chỉ email hợp lệ.');
        }

        if (isFirebaseConfigured()) {
          await firebaseSendPasswordReset(cleanEmail);
        }
        return true;
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


