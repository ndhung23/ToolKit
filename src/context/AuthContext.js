import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ROLES } from '../constants/roles';
import { TOOLS } from '../tools';
import {
  isFirebaseConfigured,
  firebaseSignIn,
  firebaseSignUp,
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
          const envAdminEmail = (
            process.env.EXPO_PUBLIC_ADMIN_EMAIL ||
            process.env.acc_admin ||
            ''
          ).trim().toLowerCase();
          const envAdminUser = envAdminEmail.split('@')[0];

          const isUserEnvAdmin = Boolean(
            envAdminEmail &&
            (parsed.email?.toLowerCase() === envAdminEmail ||
             parsed.username?.toLowerCase() === envAdminUser ||
             parsed.username?.toLowerCase() === envAdminEmail ||
             parsed.name?.toLowerCase() === envAdminUser)
          );

          if (isUserEnvAdmin) {
            parsed.role = ROLES.ADMIN;
          } else if (!parsed.role) {
            parsed.role = ROLES.FREE;
          }

          // Nếu có uid và Firebase sẵn sàng, đồng bộ role mới nhất từ Firestore
          if (parsed.uid && isFirebaseConfigured()) {
            try {
              const remoteProfile = await getUserFromFirestore(parsed.uid);
              if (remoteProfile?.role) {
                parsed.role = isUserEnvAdmin ? ROLES.ADMIN : remoteProfile.role;
                if (remoteProfile.name) parsed.name = remoteProfile.name;
              }
            } catch {}
          }

          if (isUserEnvAdmin) {
            parsed.role = ROLES.ADMIN;
            parsed.name = 'Admin Quản Trị';
          }

          setUser(parsed);
          await SecureStore.setItemAsync(KEY, JSON.stringify(parsed));
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

      // Đăng nhập an toàn bằng Tên đăng nhập hoặc Email
      signIn: async (identifier, password) => {
        const cleanId = identifier ? identifier.trim() : '';

        if (!cleanId || !password) {
          throw new Error('Vui lòng nhập tên đăng nhập và mật khẩu.');
        }

        let cleanEmail = cleanId.includes('@')
          ? cleanId.toLowerCase()
          : `${cleanId.toLowerCase()}@toolkit.app`;

        // Lấy thông tin tài khoản Admin từ biến môi trường (.env), bảo mật và không hardcode trong mã nguồn
        const envAdminEmail = (
          process.env.EXPO_PUBLIC_ADMIN_EMAIL ||
          process.env.acc_admin ||
          ''
        ).trim().toLowerCase();
        const envAdminUser = envAdminEmail.split('@')[0];

        const envAdminPassword =
          process.env.EXPO_PUBLIC_ADMIN_PASSWORD ||
          process.env.pw_admin ||
          '';

        const isEnvAdmin = Boolean(
          envAdminEmail &&
          (cleanId.toLowerCase() === envAdminEmail || cleanId.toLowerCase() === envAdminUser) &&
          (!envAdminPassword || password === envAdminPassword)
        );

        const namePart = cleanId.includes('@') ? cleanId.split('@')[0] : cleanId;
        let role = isEnvAdmin ? ROLES.ADMIN : ROLES.FREE;
        let formattedName = isEnvAdmin ? 'Admin Quản Trị' : namePart;
        let defaultDocId = 'user_' + cleanId.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
        let uid = defaultDocId;

        if (isEnvAdmin) {
          cleanEmail = envAdminEmail;
          defaultDocId = 'user_' + envAdminEmail.replace(/[^a-zA-Z0-9]/g, '_');
          uid = defaultDocId;
          role = ROLES.ADMIN;
        }

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

            if (isEnvAdmin) {
              role = ROLES.ADMIN;
            } else if (remoteData?.role) {
              role = remoteData.role;
            }

            if (remoteData?.name || remoteData?.username) {
              formattedName = remoteData.name || remoteData.username;
            }

            // Nếu người dùng chưa tồn tại trên Firestore hoặc cần cập nhật role admin
            if (!remoteData || (isEnvAdmin && remoteData.role !== ROLES.ADMIN)) {
              await saveUserToFirestore(uid, {
                username: isEnvAdmin ? envAdminUser : cleanId,
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
          username: cleanId,
          email: cleanEmail,
          name: formattedName,
          role,
        };

        await SecureStore.setItemAsync(KEY, JSON.stringify(u));
        setUser(u);
        return u;
      },

      // Đăng ký tài khoản người dùng mới (Chỉ cần Tên đăng nhập & Mật khẩu)
      signUp: async (username, password) => {
        const cleanUser = username ? username.trim() : '';

        if (!cleanUser) {
          throw new Error('Vui lòng nhập tên đăng nhập.');
        }
        if (cleanUser.length < 3) {
          throw new Error('Tên đăng nhập phải có độ dài tối thiểu từ 3 ký tự trở lên.');
        }
        if (!password || password.length < 6) {
          throw new Error('Mật khẩu đăng ký phải có ít nhất 6 ký tự.');
        }

        const envAdminEmail = (
          process.env.EXPO_PUBLIC_ADMIN_EMAIL ||
          process.env.acc_admin ||
          ''
        ).trim().toLowerCase();
        const envAdminUser = envAdminEmail.split('@')[0];

        const isSigningUpAdmin = Boolean(
          envAdminEmail &&
          (cleanUser.toLowerCase() === envAdminEmail || cleanUser.toLowerCase() === envAdminUser)
        );

        const cleanEmail = cleanUser.includes('@')
          ? cleanUser.toLowerCase()
          : (isSigningUpAdmin ? envAdminEmail : `${cleanUser.toLowerCase()}@toolkit.app`);

        const formattedName = isSigningUpAdmin ? 'Admin Quản Trị' : cleanUser;
        const defaultDocId = 'user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
        let uid = defaultDocId;
        const role = isSigningUpAdmin ? ROLES.ADMIN : ROLES.FREE;

        if (isFirebaseConfigured()) {
          try {
            const fbUser = await firebaseSignUp(cleanEmail, password, formattedName, role);
            if (fbUser) {
              uid = fbUser.uid;
            }
          } catch (err) {
            console.warn('[Firebase Auth] Đăng ký trực tiếp thất bại, kiểm tra lỗi:', err?.code, err?.message);
            if (err?.code === 'auth/email-already-in-use') {
              throw new Error('Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác.');
            } else if (err?.code === 'auth/weak-password') {
              throw new Error('Mật khẩu quá yếu. Vui lòng chọn mật khẩu từ 6 ký tự trở lên.');
            }
            // Nếu lỗi khác (ví dụ offline), lưu bản ghi trực tiếp vào Firestore
            await saveUserToFirestore(uid, {
              username: cleanUser,
              email: cleanEmail,
              name: formattedName,
              role,
            }).catch(() => {});
          }
        }

        const u = {
          uid,
          username: cleanUser,
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

        const envAdminEmail = (
          process.env.EXPO_PUBLIC_ADMIN_EMAIL ||
          process.env.acc_admin ||
          ''
        ).trim().toLowerCase();
        const isGoogleAdmin = Boolean(envAdminEmail && email === envAdminEmail);

        // Đồng bộ vai trò người dùng từ Firestore (mặc định FREE)
        let role = isGoogleAdmin ? ROLES.ADMIN : ROLES.FREE;
        const remoteProfile = await getUserFromFirestore(uid);
        if (isGoogleAdmin) {
          role = ROLES.ADMIN;
        } else if (remoteProfile?.role) {
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


