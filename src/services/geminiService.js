// src/services/geminiService.js
// Service tích hợp Google Gemini AI (Miễn phí 100% qua Google AI Studio)
// Hỗ trợ tự động tút lại chính tả STT, tóm tắt giọng nói, viết lại giọng đọc TTS
// và gợi ý chu kỳ việc vặt sinh hoạt thông minh. Kèm fallback thông minh khi chưa có key hoặc offline.

import { getStoredItem, setStoredItem } from '../utils/storage';

const STORAGE_GEMINI_KEY = '@toolkit_gemini_api_key';
const GEMINI_MODEL = 'gemini-1.5-flash';

/**
 * Lấy API Key Gemini từ máy hoặc biến môi trường
 */
export async function getGeminiApiKey() {
  try {
    const saved = await getStoredItem(STORAGE_GEMINI_KEY, '');
    if (saved && typeof saved === 'string' && saved.trim()) {
      return saved.trim();
    }
    const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
    return envKey.trim();
  } catch {
    return '';
  }
}

/**
 * Lưu API Key Gemini vào máy người dùng
 */
export async function saveGeminiApiKey(key) {
  try {
    const cleaned = (key || '').trim();
    await setStoredItem(STORAGE_GEMINI_KEY, cleaned);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gọi API Google Gemini (Bản Free Tier)
 */
export async function callGemini(prompt, systemInstruction = '') {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const msg = errData?.error?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
      throw new Error('Không nhận được phản hồi từ Gemini AI.');
    }
    return candidate.trim();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ============================================================
// 1. TÚT LẠI VĂN BẢN THU ÂM (STT POLISH)
// ============================================================

/**
 * Fallback thông minh cục bộ khi chưa có key hoặc offline
 */
function localPolishTranscript(rawText) {
  if (!rawText) return '';
  let cleaned = rawText
    // Xóa từ đệm thừa trong giao tiếp
    .replace(/\b(ờ|à|ừm|thì là mà|ấy mà|nhé bạn|nhá bạn)\b/gi, '')
    // Chuẩn hóa khoảng trắng
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return rawText;

  // Viết hoa chữ cái đầu tiên
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Thêm dấu chấm cuối câu nếu chưa có
  if (!/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }

  return cleaned;
}

export async function polishTranscriptWithAi(rawText) {
  if (!rawText || !rawText.trim()) return '';

  try {
    const prompt = `Bạn là chuyên gia ngôn ngữ Tiếng Việt. Hãy chuẩn hóa đoạn văn bản sau (vừa thu âm từ giọng nói):
1. Thêm dấu câu hợp lý (chấm, phẩy, chấm hỏi, chấm than).
2. Viết hoa chữ cái đầu câu và tên riêng.
3. Sửa các lỗi chính tả phát âm sai phổ biến của tiếng Việt.
4. Loại bỏ các từ đệm vô nghĩa (ờ, à, ừm, thì là...).
5. Tuyệt đối giữ nguyên 100% ý nghĩa nội dung của người nói, không tự bịa thêm.
Chỉ trả về duy nhất đoạn văn bản đã hoàn thiện, không giải thích hay mở đầu/kết thúc.

Văn bản gốc:
"${rawText}"`;

    const result = await callGemini(prompt);
    return result.replace(/^["']|["']$/g, '').trim();
  } catch (_err) {
    // Tự động dùng bộ tối ưu cục bộ nếu chưa có API key
    return localPolishTranscript(rawText);
  }
}

// ============================================================
// 2. TÓM TẮT Ý CHÍNH VĂN BẢN THU ÂM (STT SUMMARY)
// ============================================================

function localSummarizeTranscript(rawText) {
  const sentences = rawText.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length <= 2) {
    return `• ${rawText.trim()}`;
  }
  return sentences.slice(0, 3).map((s) => `• ${s}`).join('\n');
}

export async function summarizeTranscriptWithAi(rawText) {
  if (!rawText || !rawText.trim()) return '';

  try {
    const prompt = `Tóm tắt nội dung chính của đoạn văn bản sau thành từ 2 đến 4 gạch đầu dòng (bullet points) bằng Tiếng Việt, ngắn gọn, súc tích và dễ hiểu nhất. Chỉ trả về các gạch đầu dòng bắt đầu bằng ký tự '•'.

Nội dung:
"${rawText}"`;

    const result = await callGemini(prompt);
    return result.trim();
  } catch {
    return localSummarizeTranscript(rawText);
  }
}

// ============================================================
// 3. VIẾT LẠI VĂN PHONG ĐỌC (TTS TONE REWRITE)
// ============================================================

export async function rewriteTextToneWithAi(text, tone) {
  if (!text || !text.trim()) return text;

  try {
    const prompt = `Viết lại đoạn văn bản sau theo phong cách '${tone}' để chuẩn bị đọc thành âm thanh.
Yêu cầu:
- Ngắt nhịp tự nhiên, từ ngữ truyền cảm, không dùng từ ngữ quá hàn lâm.
- Giữ nguyên thông tin cốt lõi.
Chỉ trả về nội dung đã viết lại, không giải thích gì thêm.

Văn bản gốc:
"${text}"`;

    const result = await callGemini(prompt);
    return result.replace(/^["']|["']$/g, '').trim();
  } catch {
    return text.trim();
  }
}

// ============================================================
// 4. GỢI Ý CHU KỲ VIỆC VẶT SINH HOẠT (MICRO-HABIT AI GENERATOR)
// ============================================================

const PRESET_TOPIC_TEMPLATES = {
  student: [
    { title: 'Đóng tiền trọ', type: 'monthly', dayOfMonth: 5, color: '#EF4444', reminderTime: '09:00', unit: 'lần' },
    { title: 'Tiền điện nước phòng', type: 'monthly', dayOfMonth: 10, color: '#F59E0B', reminderTime: '10:00', unit: 'lần' },
    { title: 'Đổi bình nước lọc 20L', type: 'interval', intervalDays: 14, color: '#3B82F6', reminderTime: '08:00', unit: 'lần' },
    { title: 'Giặt chăn ga gối', type: 'interval', intervalDays: 14, color: '#8B5CF6', reminderTime: '09:00', unit: 'lần' },
    { title: 'Uống đủ nước', type: 'daily', targetCount: 8, color: '#06B6D4', reminderTime: '08:00', unit: 'cốc' },
  ],
  motor: [
    { title: 'Thay nhớt máy xe', type: 'interval', intervalDays: 50, color: '#EF4444', reminderTime: '09:00', unit: 'lần' },
    { title: 'Thay nhớt láp / hộp số', type: 'interval', intervalDays: 120, color: '#F59E0B', reminderTime: '09:00', unit: 'lần' },
    { title: 'Kiểm tra áp suất lốp & bơm', type: 'interval', intervalDays: 15, color: '#10B981', reminderTime: '08:00', unit: 'lần' },
    { title: 'Bảo dưỡng định kỳ toàn bộ xe', type: 'interval', intervalDays: 180, color: '#3B82F6', reminderTime: '09:00', unit: 'lần' },
    { title: 'Rửa xe sạch sẽ', type: 'interval', intervalDays: 7, color: '#06B6D4', reminderTime: '10:00', unit: 'lần' },
  ],
  health: [
    { title: 'Uống nước trong ngày', type: 'daily', targetCount: 8, color: '#3B82F6', reminderTime: '08:00', unit: 'cốc' },
    { title: 'Uống Vitamin / Thuốc', type: 'daily', targetCount: 2, color: '#EF4444', reminderTime: '08:00', unit: 'lần' },
    { title: 'Vận động thể thao 30 phút', type: 'daily', targetCount: 1, color: '#10B981', reminderTime: '17:30', unit: 'lần' },
    { title: 'Ngủ sớm trước 23h', type: 'daily', targetCount: 1, color: '#8B5CF6', reminderTime: '22:45', unit: 'lần' },
    { title: 'Cân trọng lượng cơ thể', type: 'interval', intervalDays: 7, color: '#F59E0B', reminderTime: '07:00', unit: 'lần' },
  ],
  pet: [
    { title: 'Dọn & thay cát mèo', type: 'interval', intervalDays: 3, color: '#F59E0B', reminderTime: '08:00', unit: 'lần' },
    { title: 'Tắm & sấy lông cho thú cưng', type: 'interval', intervalDays: 14, color: '#3B82F6', reminderTime: '09:00', unit: 'lần' },
    { title: 'Nhỏ thuốc rận gáy', type: 'interval', intervalDays: 30, color: '#EF4444', reminderTime: '10:00', unit: 'lần' },
    { title: 'Tẩy giun định kỳ', type: 'interval', intervalDays: 90, color: '#8B5CF6', reminderTime: '09:00', unit: 'lần' },
    { title: 'Cho ăn đúng bữa', type: 'daily', targetCount: 2, color: '#10B981', reminderTime: '07:30', unit: 'bữa' },
  ],
  home: [
    { title: 'Đóng tiền internet / 4G', type: 'monthly', dayOfMonth: 20, color: '#3B82F6', reminderTime: '09:00', unit: 'lần' },
    { title: 'Đổi bình gas / kiểm tra bếp', type: 'interval', intervalDays: 60, color: '#EF4444', reminderTime: '10:00', unit: 'lần' },
    { title: 'Thay lõi máy lọc nước', type: 'interval', intervalDays: 90, color: '#06B6D4', reminderTime: '09:00', unit: 'lần' },
    { title: 'Tổng vệ sinh nhà cửa', type: 'interval', intervalDays: 7, color: '#10B981', reminderTime: '08:00', unit: 'lần' },
  ],
};

export async function generateHabitsWithAi(topicOrNeed) {
  const query = (topicOrNeed || '').trim().toLowerCase();

  // Thử gọi Gemini AI nếu có key
  try {
    const prompt = `Bạn là chuyên gia tổ chức cuộc sống và thói quen sinh hoạt. Người dùng có nhu cầu: "${topicOrNeed}".
Hãy đề xuất 3 đến 5 chu kỳ việc vặt sinh hoạt phù hợp nhất.
Chỉ trả về JSON thuần túy (không bọc trong \`\`\`), là một mảng:
[
  {
    "title": "Tên việc vặt",
    "type": "interval" hoặc "monthly" hoặc "daily",
    "intervalDays": 45,
    "dayOfMonth": 5,
    "targetCount": 2,
    "unit": "lần" hoặc "cốc" hoặc "viên",
    "reminderTime": "08:00",
    "color": "#EF4444"
  }
]
Lưu ý:
- "interval": chu kỳ lặp lại theo số ngày (intervalDays > 0)
- "monthly": chu kỳ cố định ngày trong tháng (dayOfMonth từ 1 đến 28)
- "daily": chu kỳ lặp trong ngày (targetCount > 0, unit là đơn vị đếm)`;

    const raw = await callGemini(prompt);
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => ({
          title: item.title || `Việc vặt ${idx + 1}`,
          type: ['interval', 'monthly', 'daily'].includes(item.type) ? item.type : 'interval',
          intervalDays: Number(item.intervalDays) || 30,
          dayOfMonth: Number(item.dayOfMonth) || 5,
          targetCount: Number(item.targetCount) || 1,
          unit: item.unit || 'lần',
          reminderTime: item.reminderTime || '08:00',
          color: item.color || '#3B82F6',
        }));
      }
    }
  } catch {
    // Tự động dùng kho mẫu thông minh tương thích cao nhất
  }

  // Khớp chủ đề cục bộ
  if (query.includes('xe') || query.includes('nhớt') || query.includes('bảo dưỡng')) {
    return PRESET_TOPIC_TEMPLATES.motor;
  }
  if (query.includes('mèo') || query.includes('chó') || query.includes('thú cưng') || query.includes('pet')) {
    return PRESET_TOPIC_TEMPLATES.pet;
  }
  if (query.includes('trọ') || query.includes('sinh viên') || query.includes('phòng')) {
    return PRESET_TOPIC_TEMPLATES.student;
  }
  if (query.includes('nhà') || query.includes('gas') || query.includes('lọc nước')) {
    return PRESET_TOPIC_TEMPLATES.home;
  }
  return PRESET_TOPIC_TEMPLATES.health;
}
