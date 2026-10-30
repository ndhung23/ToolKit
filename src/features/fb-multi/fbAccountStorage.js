import * as SecureStore from 'expo-secure-store';

const STORAGE_KEYS = {
  ACCOUNTS_LIST: 'fb_multi_accounts_v1',
  ACTIVE_ACCOUNT_ID: 'fb_multi_active_id_v1',
};

/**
 * Trích xuất các key-value từ chuỗi Cookie của Facebook
 * @param {string} cookieStr Chuỗi cookie (ví dụ: "c_user=100012345; xs=abc:def;...")
 * @returns {{ c_user?: string, xs?: string, datr?: string, sb?: string, [key: string]: string }}
 */
export function parseFacebookCookies(cookieStr) {
  if (!cookieStr || typeof cookieStr !== 'string') return {};
  const result = {};
  const parts = cookieStr.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      result[key] = val;
    }
  }
  return result;
}

/**
 * Kiểm tra xem chuỗi cookie có hợp lệ và chứa c_user (Facebook UID) hay không
 * @param {string} cookieStr
 * @returns {boolean}
 */
export function isFacebookCookieValid(cookieStr) {
  const parsed = parseFacebookCookies(cookieStr);
  return Boolean(parsed.c_user && parsed.c_user.length > 4);
}

/**
 * Lấy danh sách toàn bộ tài khoản Facebook đã lưu trong SecureStore
 * @returns {Promise<Array<{ id: string, name: string, nickname?: string, avatarUrl?: string, cookies: string, lastActive: number, createdAt: number }>>}
 */
export async function getStoredAccounts() {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEYS.ACCOUNTS_LIST);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('[fbAccountStorage] getStoredAccounts error:', error);
    return [];
  }
}

/**
 * Lưu danh sách tài khoản vào SecureStore
 * @param {Array} accounts
 */
async function saveAllAccounts(accounts) {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCOUNTS_LIST, JSON.stringify(accounts));
  } catch (error) {
    console.error('[fbAccountStorage] saveAllAccounts error:', error);
    throw error;
  }
}

/**
 * Lấy ID tài khoản đang active
 * @returns {Promise<string | null>}
 */
export async function getActiveAccountId() {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.ACTIVE_ACCOUNT_ID);
  } catch (error) {
    console.error('[fbAccountStorage] getActiveAccountId error:', error);
    return null;
  }
}

/**
 * Đặt ID tài khoản đang active
 * @param {string} id
 */
export async function setActiveAccountId(id) {
  try {
    if (!id) {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ACTIVE_ACCOUNT_ID);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_ACCOUNT_ID, String(id));
    }
  } catch (error) {
    console.error('[fbAccountStorage] setActiveAccountId error:', error);
  }
}

/**
 * Thêm hoặc cập nhật một tài khoản Facebook
 * @param {{ id: string, name?: string, nickname?: string, avatarUrl?: string, cookies: string }} accountData
 * @returns {Promise<Array>} Danh sách tài khoản sau khi cập nhật
 */
export async function saveOrUpdateAccount(accountData) {
  if (!accountData || !accountData.id || !accountData.cookies) {
    throw new Error('Thiếu thông tin tài khoản hoặc cookie Facebook.');
  }

  const existingAccounts = await getStoredAccounts();
  const idStr = String(accountData.id).trim();
  const now = Date.now();

  const avatar = accountData.avatarUrl || `https://graph.facebook.com/${idStr}/picture?type=large`;
  const name = accountData.name || `Người dùng ${idStr.slice(-4)}`;

  const existingIndex = existingAccounts.findIndex((acc) => acc.id === idStr);

  let updatedList;
  if (existingIndex >= 0) {
    const old = existingAccounts[existingIndex];
    const updated = {
      ...old,
      ...accountData,
      id: idStr,
      name: accountData.name || old.name,
      nickname: accountData.nickname !== undefined ? accountData.nickname : old.nickname,
      avatarUrl: avatar || old.avatarUrl,
      cookies: accountData.cookies || old.cookies,
      lastActive: now,
    };
    updatedList = [...existingAccounts];
    updatedList[existingIndex] = updated;
  } else {
    const newAccount = {
      id: idStr,
      name,
      nickname: accountData.nickname || '',
      avatarUrl: avatar,
      cookies: accountData.cookies,
      lastActive: now,
      createdAt: now,
    };
    updatedList = [newAccount, ...existingAccounts];
  }

  await saveAllAccounts(updatedList);
  await setActiveAccountId(idStr);
  return updatedList;
}

/**
 * Cập nhật tên gợi nhớ (nickname) cho tài khoản
 * @param {string} id
 * @param {string} nickname
 */
export async function updateAccountNickname(id, nickname) {
  const accounts = await getStoredAccounts();
  const idStr = String(id).trim();
  const index = accounts.findIndex((a) => a.id === idStr);
  if (index >= 0) {
    accounts[index] = { ...accounts[index], nickname: nickname.trim() };
    await saveAllAccounts(accounts);
    return accounts;
  }
  return accounts;
}

/**
 * Xóa một tài khoản khỏi danh sách
 * @param {string} id
 * @returns {Promise<{ accounts: Array, newActiveId: string | null }>}
 */
export async function removeAccount(id) {
  const accounts = await getStoredAccounts();
  const idStr = String(id).trim();
  const filtered = accounts.filter((a) => a.id !== idStr);
  await saveAllAccounts(filtered);

  const activeId = await getActiveAccountId();
  let newActiveId = activeId;

  if (activeId === idStr) {
    newActiveId = filtered.length > 0 ? filtered[0].id : null;
    await setActiveAccountId(newActiveId);
  }

  return { accounts: filtered, newActiveId };
}
