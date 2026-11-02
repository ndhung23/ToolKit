import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from '../../utils/storage';
import { ROLES } from '../../constants/roles';
import { TOOLS } from '../../tools';
import {
  isFirebaseConfigured,
  firebaseSignIn,
  firebaseSignUp,
  firebaseSignOut,
  firebaseSignInWithGoogle,
  firebaseSendPasswordReset,
  saveUserToFirestore,
  getUserFromFirestore,
  saveToolTierToFirestore,
  getToolTiersFromFirestore,
} from '../../services/firebase';

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
        if (raw && isFirebaseConfigured()) {
          const parsed = JSON.parse(raw);
          if (!parsed.uid) throw new Error('Phiên đăng nhập không hợp lệ.');
          const remoteProfile = await getUserFromFirestore(parsed.uid);
          if (!remoteProfile) throw new Error('Không tìm thấy hồ sơ tài khoản.');
          parsed.role = remoteProfile.role || ROLES.FREE;
          parsed.name = remoteProfile.name || parsed.name;

          setUser(parsed);
          await SecureStore.setItemAsync(KEY, JSON.stringify(parsed));
        }
      } catch {
        await SecureStore.deleteItemAsync(KEY);
      }
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

        if (!isFirebaseConfigured()) {
          throw new Error('Đăng nhập yêu cầu cấu hình Firebase trên máy chủ.');
        }
        const cleanEmail = cleanId.includes('@')
          ? cleanId.toLowerCase()
          : `${cleanId.toLowerCase()}@toolkit.app`;
        const fbUser = await firebaseSignIn(cleanEmail, password);
        if (!fbUser) throw new Error('Không thể xác thực tài khoản.');
        const remoteData = await getUserFromFirestore(fbUser.uid);
        const role = remoteData?.role || ROLES.FREE;
        const formattedName = remoteData?.name || remoteData?.username || cleanId;

        const u = {
          uid: fbUser.uid,
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

        const cleanEmail = cleanUser.includes('@')
          ? cleanUser.toLowerCase()
          : `${cleanUser.toLowerCase()}@toolkit.app`;
        if (!isFirebaseConfigured()) throw new Error('Đăng ký yêu cầu cấu hình Firebase trên máy chủ.');
        const formattedName = cleanUser;
        const role = ROLES.FREE;
        let fbUser;
        try {
          fbUser = await firebaseSignUp(cleanEmail, password, formattedName, role);
        } catch (err) {
            console.warn('[Firebase Auth] Đăng ký trực tiếp thất bại, kiểm tra lỗi:', err?.code, err?.message);
            if (err?.code === 'auth/email-already-in-use') {
              throw new Error('Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác.');
            } else if (err?.code === 'auth/weak-password') {
              throw new Error('Mật khẩu quá yếu. Vui lòng chọn mật khẩu từ 6 ký tự trở lên.');
            }
        }
        if (!fbUser) throw new Error('Không thể tạo tài khoản.');

        const u = {
          uid: fbUser.uid,
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

        // Chỉ Firestore quyết định quyền; không tin role hay biến môi trường trong app.
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


