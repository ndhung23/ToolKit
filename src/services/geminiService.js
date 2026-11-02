// src/services/geminiService.js
// Service tích hợp Google Gemini AI (Miễn phí 100% qua Google AI Studio)
// Hỗ trợ tự động gợi ý chu kỳ việc vặt sinh hoạt thông minh. Kèm fallback thông minh khi offline hoặc chưa có mạng.

const GEMINI_MODEL = 'gemini-3-flash-preview';
const FALLBACK_MODEL = 'gemini-3.5-flash';
const GEMINI_API_URL = process.env.EXPO_PUBLIC_GEMINI_API_URL;

/**
 * Gọi API Google Gemini (Bản Free Tier)
 */
export async function callGemini(prompt, systemInstruction = '') {
  if (!GEMINI_API_URL) {
    throw new Error('AI_BACKEND_NOT_CONFIGURED');
  }

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const tryCallModel = async (modelName) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);

    try {
      const res = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...requestBody, model: modelName }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const msg = errData?.error?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const data = await res.json();
      const candidate = data?.text;
      if (!candidate) {
        throw new Error('Không nhận được phản hồi từ Gemini AI.');
      }
      return candidate.trim();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  };

  try {
    return await tryCallModel(GEMINI_MODEL);
  } catch (err) {
    try {
      return await tryCallModel(FALLBACK_MODEL);
    } catch {
      throw err;
    }
  }
}

// ============================================================
// GỢI Ý CHU KỲ VIỆC VẶT SINH HOẠT (MICRO-HABIT AI GENERATOR)
// ============================================================

const PRESET_TOPIC_TEMPLATES = {
  study: [
    { title: 'Xem lại thời khóa biểu ngày mai', type: 'daily', targetCount: 1, color: '#3B82F6', reminderTime: '21:00', unit: 'lần' },
    { title: 'Soạn sách vở và bài tập cần nộp', type: 'daily', targetCount: 1, color: '#8B5CF6', reminderTime: '21:30', unit: 'lần' },
    { title: 'Thức dậy và chuẩn bị đồ đi học', type: 'daily', targetCount: 1, color: '#10B981', reminderTime: '06:00', unit: 'lần' },
    { title: 'Ăn sáng trước giờ lên lớp', type: 'daily', targetCount: 1, color: '#F59E0B', reminderTime: '06:30', unit: 'lần' },
    { title: 'Xuất phát đến trường đúng giờ', type: 'daily', targetCount: 1, color: '#06B6D4', reminderTime: '06:50', unit: 'lần' },
  ],
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

  // 1. Thử gọi Gemini AI
  try {
    const prompt = `Bạn là chuyên gia tổ chức cuộc sống và thói quen sinh hoạt. Người dùng có nhu cầu: "${topicOrNeed}".
Hãy đề xuất 3 đến 5 chu kỳ việc vặt sinh hoạt phù hợp nhất với đúng nhu cầu đó.
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
  } catch (err) {
    console.warn('[Gemini AI] generateHabitsWithAi fallback:', err.message);
  }

  // 2. Khớp chủ đề cục bộ khi offline hoặc mạng gián đoạn
  if (query.includes('học') || query.includes('trường') || query.includes('lớp') || query.includes('thời khóa biểu') || query.includes('sách')) {
    return PRESET_TOPIC_TEMPLATES.study;
  }
  if (query.includes('xe') || query.includes('nhớt') || query.includes('bảo dưỡng') || query.includes('lốp')) {
    return PRESET_TOPIC_TEMPLATES.motor;
  }
  if (query.includes('mèo') || query.includes('chó') || query.includes('thú cưng') || query.includes('pet')) {
    return PRESET_TOPIC_TEMPLATES.pet;
  }
  if (query.includes('trọ') || query.includes('sinh viên') || query.includes('phòng')) {
    return PRESET_TOPIC_TEMPLATES.student;
  }
  if (query.includes('nhà') || query.includes('gas') || query.includes('lọc nước') || query.includes('dọn dẹp')) {
    return PRESET_TOPIC_TEMPLATES.home;
  }
  if (query.includes('sức khỏe') || query.includes('thuốc') || query.includes('nước') || query.includes('ngủ') || query.includes('tập')) {
    return PRESET_TOPIC_TEMPLATES.health;
  }

  // Fallback thông minh theo từ khóa người dùng nhập thay vì trả bừa mẫu không liên quan
  return [
    { title: `Nhắc việc: ${topicOrNeed}`, type: 'daily', targetCount: 1, color: '#3B82F6', reminderTime: '08:00', unit: 'lần' },
    { title: `Chuẩn bị cho ${topicOrNeed}`, type: 'daily', targetCount: 1, color: '#10B981', reminderTime: '07:00', unit: 'lần' },
    { title: `Đánh giá tiến độ ${topicOrNeed}`, type: 'interval', intervalDays: 7, color: '#8B5CF6', reminderTime: '20:00', unit: 'lần' },
  ];
}
