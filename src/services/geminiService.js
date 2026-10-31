import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_CUSTOM_KEY_STORAGE = '@toolkit_gemini_custom_key';
const GEMINI_CHAT_HISTORY_STORAGE = '@toolkit_gemini_chat_history';

/**
 * Lấy API Key đang hoạt động (Ưu tiên Custom Key của người dùng -> Fallback về .env)
 * @returns {Promise<string>}
 */
export async function getActiveGeminiKey() {
  try {
    const customKey = await AsyncStorage.getItem(GEMINI_CUSTOM_KEY_STORAGE);
    if (customKey && customKey.trim().length > 0) {
      return customKey.trim();
    }
  } catch (_e) {
    // ignore
  }
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
}

/**
 * Lưu Custom API Key do người dùng nhập
 * @param {string} key
 */
export async function setCustomGeminiKey(key) {
  if (!key || !key.trim()) {
    await AsyncStorage.removeItem(GEMINI_CUSTOM_KEY_STORAGE);
  } else {
    await AsyncStorage.setItem(GEMINI_CUSTOM_KEY_STORAGE, key.trim());
  }
}

/**
 * Đọc Custom Key đã lưu (nếu có)
 * @returns {Promise<string>}
 */
export async function getSavedCustomKey() {
  try {
    return (await AsyncStorage.getItem(GEMINI_CUSTOM_KEY_STORAGE)) || '';
  } catch (_e) {
    return '';
  }
}

/**
 * Lấy lịch sử trò chuyện đã lưu
 * @returns {Promise<Array>}
 */
export async function getSavedChatHistory() {
  try {
    const raw = await AsyncStorage.getItem(GEMINI_CHAT_HISTORY_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_e) {
    // ignore
  }
  return [];
}

/**
 * Lưu lịch sử trò chuyện
 * @param {Array} history
 */
export async function saveChatHistory(history) {
  try {
    // Giới hạn lưu tối đa 40 tin nhắn gần nhất để tối ưu dung lượng và tốc độ
    const trimmed = (history || []).slice(-40);
    await AsyncStorage.setItem(GEMINI_CHAT_HISTORY_STORAGE, JSON.stringify(trimmed));
  } catch (_e) {
    // ignore
  }
}

/**
 * Xóa sạch lịch sử trò chuyện
 */
export async function clearChatHistory() {
  try {
    await AsyncStorage.removeItem(GEMINI_CHAT_HISTORY_STORAGE);
  } catch (_e) {
    // ignore
  }
}

/**
 * Gửi tin nhắn đến Google Gemini 1.5 Flash
 * @param {Array} messages - Danh sách tin nhắn [{ id, role: 'user'|'model', text, timestamp }]
 * @param {string} promptText - Câu hỏi / tin nhắn mới của người dùng
 * @returns {Promise<string>} - Nội dung phản hồi từ AI
 */
export async function sendToGemini(messages, promptText) {
  const apiKey = await getActiveGeminiKey();

  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình Gemini API Key. Vui lòng bấm vào biểu tượng Cài đặt bánh răng trên khung chat để nhập API Key của bạn.'
    );
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  // Chuẩn hóa danh sách tin nhắn cho định dạng contents của Gemini API
  // Chỉ lấy tối đa 10 lượt hội thoại gần nhất để tránh tràn context
  const recentMessages = (messages || []).slice(-10);

  const contents = recentMessages.map((msg) => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text || '' }],
  }));

  // Đính kèm câu hỏi mới của người dùng
  contents.push({
    role: 'user',
    parts: [{ text: promptText }],
  });

  const requestBody = {
    system_instruction: {
      parts: [
        {
          text:
            'Bạn là Trợ lý AI ToolKit thông minh, hữu ích và thân thiện. Bạn hỗ trợ người dùng trò chuyện, trả lời câu hỏi, soạn thảo tin nhắn lịch sự, dịch thuật ngôn ngữ, và gợi ý phản hồi tin nhắn khách hàng / bạn bè. Luôn trả lời bằng tiếng Việt tự nhiên, súc tích, định dạng gạch đầu dòng rõ ràng khi cần thiết.',
        },
      ],
    },
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Lỗi từ máy chủ Gemini (Mã: ${response.status})`;
    if (response.status === 400 || response.status === 403) {
      throw new Error(`API Key không hợp lệ hoặc đã hết hạn: ${errorMsg}`);
    }
    throw new Error(errorMsg);
  }

  const candidate = data?.candidates?.[0];
  const replyText = candidate?.content?.parts?.[0]?.text;

  if (!replyText) {
    throw new Error('AI không thể tạo câu trả lời cho yêu cầu này. Vui lòng thử lại.');
  }

  return replyText.trim();
}
