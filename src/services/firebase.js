// src/services/firebase.js
// Dịch vụ tích hợp Firebase Authentication và Cloud Firestore cho ToolKit (MMA301)

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ROLES } from '../constants/roles';

// Cấu hình Firebase đọc từ biến môi trường (EXPO_PUBLIC_...)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

// Kiểm tra xem Firebase đã được cấu hình với API Key thật hay chưa
export const isFirebaseConfigured = () => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey.length > 10 &&
    firebaseConfig.projectId
  );
};

// Khởi tạo Firebase App
let app = null;
let auth = null;
let db = null;

try {
  if (isFirebaseConfigured()) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.warn('[Firebase] Khởi tạo ở chế độ Offline Fallback:', e?.message);
}

export { auth, db };

/* ===================================================================
 * 1. DỊCH VỤ AUTHENTICATION
 * =================================================================== */

// Đăng nhập Firebase Auth
export async function firebaseSignIn(email, password) {
  if (!isFirebaseConfigured() || !auth) {
    // Chế độ fallback offline
    return null;
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err) {
    console.warn('[Firebase Auth] Đăng nhập lỗi, chuyển sang Fallback:', err.message);
    throw err;
  }
}

// Đăng ký Firebase Auth & tự động tạo profile trên Firestore
export async function firebaseSignUp(email, password, name, role = ROLES.FREE) {
  if (!isFirebaseConfigured() || !auth) {
    return null;
  }
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  // Tạo document trong collection 'users'
  await saveUserToFirestore(user.uid, {
    email: user.email,
    name: name || email.split('@')[0],
    role,
    createdAt: new Date().toISOString(),
  });

  return user;
}

// Đăng xuất Firebase
export async function firebaseSignOut() {
  if (auth) {
    try {
      await signOut(auth);
    } catch {}
  }
}

/* ===================================================================
 * 2. CLOUD FIRESTORE: QUẢN LÝ USER VÀ ROLE
 * =================================================================== */

// Lưu thông tin người dùng vào collection 'users'
export async function saveUserToFirestore(uid, userData) {
  if (!isFirebaseConfigured() || !db) return null;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      ...userData,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Lỗi lưu user profile:', err.message);
    return false;
  }
}

// Lấy thông tin user kèm vai trò từ Firestore
export async function getUserFromFirestore(uid) {
  if (!isFirebaseConfigured() || !db) return null;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn('[Firestore] Lỗi đọc user profile:', err.message);
  }
  return null;
}

// Cập nhật vai trò (Role) cho người dùng trong Firestore
export async function updateUserRoleInFirestore(uid, newRole) {
  if (!isFirebaseConfigured() || !db) return false;
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn('[Firestore] Lỗi cập nhật role:', err.message);
    return false;
  }
}

// Lấy danh sách toàn bộ người dùng cho AdminScreen
export async function getAllUsersFromFirestore() {
  if (!isFirebaseConfigured() || !db) return [];
  try {
    const colRef = collection(db, 'users');
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[Firestore] Lỗi lấy danh sách user:', err.message);
    return [];
  }
}

/* ===================================================================
 * 3. CLOUD FIRESTORE: QUẢN LÝ CÔNG TẮC TÍNH NĂNG (FEATURE TOGGLES)
 * =================================================================== */

// Lưu trạng thái công tắc tính năng lên Firestore
export async function saveFeatureToggleToFirestore(toolId, isEnabled) {
  if (!isFirebaseConfigured() || !db) return false;
  try {
    const docRef = doc(db, 'feature_toggles', 'status');
    await setDoc(docRef, { [toolId]: isEnabled }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Lỗi lưu feature toggle:', err.message);
    return false;
  }
}

// Lấy trạng thái công tắc tính năng từ Firestore
export async function getFeatureTogglesFromFirestore() {
  if (!isFirebaseConfigured() || !db) return null;
  try {
    const docRef = doc(db, 'feature_toggles', 'status');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn('[Firestore] Lỗi đọc feature toggles:', err.message);
  }
  return null;
}

/* ===================================================================
 * 4. CLOUD FIRESTORE: NHẬT KÝ SỬ DỤNG TIỆN ÍCH (USAGE LOGS)
 * =================================================================== */

// Ghi nhật ký mỗi khi người dùng truy cập tiện ích
export async function logToolUsageToFirestore(toolId, user) {
  if (!isFirebaseConfigured() || !db) return;
  try {
    const colRef = collection(db, 'usage_logs');
    await addDoc(colRef, {
      toolId,
      userEmail: user?.email || 'anonymous',
      role: user?.role || ROLES.FREE,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Không làm gián đoạn người dùng nếu ghi log thất bại
    console.warn('[Firestore] Lỗi ghi nhật ký tiện ích:', err.message);
  }
}
