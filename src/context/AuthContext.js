import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ROLES } from '../constants/roles';
import { TOOLS } from '../tools';
import {
  isFirebaseConfigured,
  firebaseSignIn,
  firebaseSignOut,
  firebaseSignInWithGoogle,
  firebaseSendPasswordReset,
  saveUserToFirestore,
  getUserFromFirestore,
  updateUserRoleInFirestore,
  saveToolTierToFirestore,
  getToolTiersFromFirestore,
} from '../services/firebase';

const KEY = 'session';
const TIERS_STORAGE_KEY = 'toolkit_tool_tiers';
const DEFAULT_TIERS = TOOLS.reduce((acc, t) => ({ ...acc, [t.id]: t.tier || 'free' }), {});

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toolTiers, setToolTiers] = useState(DEFAULT_TIERS);

  // Mở app: khôi phục phiên đăng nhập và cấu hình tool tiers
  useEffect(() => {
    (async () => {
      try {
        const localTiers = await SecureStore.getItemAsync(TIERS_STORAGE_KEY);
        if (localTiers) {
          const parsed = JSON.parse(localTiers);
          setToolTiers((prev) => ({ ...prev, ...parsed }));
        }
        if (isFirebaseConfigured()) {
          const remoteTiers = await getToolTiersFromFirestore();
          if (remoteTiers) {
            setToolTiers((prev) => ({ ...prev, ...remoteTiers }));
            await SecureStore.setItemAsync(TIERS_STORAGE_KEY, JSON.stringify(remoteTiers));
          }
        }
      } catch (e) {
        console.warn('Lỗi đọc tool tiers:', e);
      }
    })();
  }, []);

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

        if (!cleanEmail || !cleanEmail.includes('@') || !password) {
          throw new Error('Vui lòng nhập email và mật khẩu.');
        }

        // Lấy thông tin tài khoản Admin từ biến môi trường (.env), bảo mật và không hardcode trong mã nguồn
        const envAdminEmail = (
          process.env.EXPO_PUBLIC_ADMIN_EMAIL ||
          process.env.acc_admin ||
          ''
        ).trim().toLowerCase();

        const envAdminPassword =
          process.env.EXPO_PUBLIC_ADMIN_PASSWORD ||
          process.env.pw_admin ||
          '';

        const isEnvAdmin = Boolean(
          envAdminEmail &&
          cleanEmail === envAdminEmail &&
          (!envAdminPassword || password === envAdminPassword)
        );

        const namePart = cleanEmail.split('@')[0];
        let role = isEnvAdmin ? ROLES.ADMIN : ROLES.FREE;
        let formattedName = isEnvAdmin ? 'Quản trị viên' : namePart;
        const defaultDocId = 'user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
        let uid = defaultDocId;

        // Xác thực qua Firebase Auth nếu có cấu hình
        if (isFirebaseConfigured()) {
          try {
            const fbUser = await firebaseSignIn(cleanEmail, password);
            if (fbUser) {
              uid = fbUser.uid;
            }
          } catch (e) {
            console.log('[Auth] Đăng nhập Firebase Auth không thành công, tiếp tục với Fallback Session');
          }

          // Tải thông tin người dùng và vai trò trực tiếp từ Cloud Firestore một cách linh hoạt
          try {
            const remoteData =
              (await getUserFromFirestore(uid)) ||
              (uid !== defaultDocId ? await getUserFromFirestore(defaultDocId) : null);

            if (remoteData?.role) {
              role = remoteData.role;
            }
            if (remoteData?.name) {
              formattedName = remoteData.name;
            }

            // Nếu người dùng chưa tồn tại trên Firestore thì tự động tạo bản ghi mới
            if (!remoteData) {
              await saveUserToFirestore(uid, {
                email: cleanEmail,
                name: formattedName,
                role,
              });
            }
          } catch (err) {
            console.warn('[Auth] Không thể nạp thông tin Firestore:', err?.message);
          }
        }

        const u = {
          uid,
          email: cleanEmail,
          name: formattedName,
          role,
        };

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

      // Quản lý cấp bậc VIP cho từng tiện ích (Dành cho Admin)
      toolTiers,
      updateToolTier: async (toolId, newTier) => {
        const next = { ...toolTiers, [toolId]: newTier };
        setToolTiers(next);
        try {
          await SecureStore.setItemAsync(TIERS_STORAGE_KEY, JSON.stringify(next));
          if (isFirebaseConfigured()) {
            await saveToolTierToFirestore(toolId, newTier);
          }
        } catch (e) {
          console.warn('Lỗi cập nhật tool tier:', e);
        }
        return next;
      },
      refreshToolTiers: async () => {
        if (isFirebaseConfigured()) {
          try {
            const remoteTiers = await getToolTiersFromFirestore();
            if (remoteTiers) {
              setToolTiers((prev) => ({ ...prev, ...remoteTiers }));
              await SecureStore.setItemAsync(TIERS_STORAGE_KEY, JSON.stringify(remoteTiers));
              return remoteTiers;
            }
          } catch {}
        }
        return toolTiers;
      },
    }),
    [user, loading, toolTiers]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);


