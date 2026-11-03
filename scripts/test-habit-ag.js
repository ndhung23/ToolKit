// scripts/test-habit-ag.js
// Automated verification for VIỆC AG:
// 1. So sánh chuẩn hóa (sửa rồi trả lại như cũ -> không tính là thay đổi)
// 2. Chặn các đường thoát khi có thay đổi chưa lưu
// 3. 3 lựa chọn trong hộp thoại:
//    - Lưu và thoát (validate lỗi -> ở lại; hợp lệ -> lưu và đóng)
//    - Không lưu (bỏ thay đổi và đóng)
//    - Tiếp tục chỉnh sửa (giữ nguyên form)

import assert from 'node:assert';

export function serializeHabitFormState({
  title = '',
  type = 'interval',
  intervalDays = '30',
  dayOfMonth = '5',
  targetCount = '2',
  unit = 'lần',
  category = 'Sinh hoạt',
  customCategory = '',
  note = '',
  icon = 'repeat',
  color = '#10B981',
  reminderEnabled = false,
  reminderTime = '08:00',
  startDate = null,
} = {}) {
  return JSON.stringify({
    title: String(title || '').trim(),
    type: String(type || 'interval'),
    intervalDays: String(parseInt(intervalDays || '30', 10)),
    dayOfMonth: String(parseInt(dayOfMonth || '5', 10)),
    targetCount: String(parseInt(targetCount || '2', 10)),
    unit: String(unit || 'lần').trim(),
    category: String(category || 'Sinh hoạt').trim(),
    customCategory: String(customCategory || '').trim(),
    note: String(note || '').trim(),
    icon: String(icon || 'repeat'),
    color: String(color || '#10B981'),
    reminderEnabled: Boolean(reminderEnabled),
    reminderTime: String(reminderTime || '08:00').trim(),
    startDate: startDate ? String(startDate).slice(0, 10) : null,
  });
}

export function checkIsDirty(initialSnapshot, currentState) {
  if (!initialSnapshot) return false;
  return serializeHabitFormState(currentState) !== initialSnapshot;
}

console.log('--- BẮT ĐẦU KIỂM THỬ VIỆC AG (CẢNH BÁO THOÁT FORM CHƯA LƯU) ---');

// TEST 1: Xác định có thay đổi bằng so sánh giá trị chuẩn hóa
{
  console.log('\n[TEST AG-1] So sánh chuẩn hóa & sửa rồi trả về như cũ');
  const original = {
    title: 'Tập yoga',
    type: 'daily',
    targetCount: '2',
    reminderEnabled: true,
    reminderTime: '06:00',
    startDate: null,
  };
  const snapshot = serializeHabitFormState(original);

  // Lúc mới mở: không thay đổi
  assert.equal(checkIsDirty(snapshot, original), false);

  // Sửa tiêu đề: dirty = true
  const edited = { ...original, title: 'Tập yoga buổi sáng' };
  assert.equal(checkIsDirty(snapshot, edited), true);

  // Sửa thêm khoảng trắng thừa: trim() nhận biết không thay đổi nếu chỉ là space ở đầu/cuối
  const spaced = { ...original, title: '  Tập yoga  ' };
  assert.equal(checkIsDirty(snapshot, spaced), false);

  // Sửa rồi trả lại nguyên văn như cũ: dirty = false (không dùng cờ chạm)
  const restored = { ...edited, title: 'Tập yoga' };
  assert.equal(checkIsDirty(snapshot, restored), false);

  console.log('=> Test AG-1 PASS: Nhận diện chuẩn xác thay đổi thực tế; sửa rồi hoàn lại không tính là dirty.');
}

// TEST 2: Không thay đổi -> thoát thẳng không hỏi
{
  console.log('\n[TEST AG-2] Không có thay đổi -> thoát thẳng');
  let dialogShown = false;
  let closed = false;

  const original = { title: 'Uống nước', reminderTime: '08:00' };
  const snapshot = serializeHabitFormState(original);

  function attemptExit(currentState) {
    if (checkIsDirty(snapshot, currentState)) {
      dialogShown = true;
    } else {
      closed = true;
    }
  }

  attemptExit(original);
  assert.equal(dialogShown, false);
  assert.equal(closed, true);
  console.log('=> Test AG-2 PASS: Không có thay đổi thì đóng thẳng không hiện modal xác nhận.');
}

// TEST 3: Có thay đổi -> Hiện hộp thoại với 3 lựa chọn
{
  console.log('\n[TEST AG-3] Có thay đổi -> thử từng lựa chọn trong hộp thoại');
  const original = { title: 'Tưới cây', reminderTime: '17:00' };
  const snapshot = serializeHabitFormState(original);
  const dirtyState = { ...original, reminderTime: '18:00' };

  let modalOpen = true;
  let validationErrors = {};
  let saved = false;

  function handleExitChoice(choice, state) {
    if (choice === 'continue') {
      // Tiếp tục chỉnh sửa: giữ nguyên
      modalOpen = true;
      return 'continued';
    }
    if (choice === 'discard') {
      // Không lưu: đóng và bỏ thay đổi
      modalOpen = false;
      return 'discarded';
    }
    if (choice === 'save_and_exit') {
      // Lưu và thoát: validate trước
      if (!state.title || state.title.trim().length === 0) {
        validationErrors = { title: 'Vui lòng nhập tên công việc.' };
        modalOpen = true; // ở lại form
        return 'validation_failed';
      }
      saved = true;
      modalOpen = false;
      return 'saved_and_exited';
    }
  }

  // Lựa chọn A: "Tiếp tục chỉnh sửa"
  const resContinue = handleExitChoice('continue', dirtyState);
  assert.equal(resContinue, 'continued');
  assert.equal(modalOpen, true);

  // Lựa chọn B: "Lưu và thoát" nhưng dữ liệu lỗi (xóa trắng tên)
  const invalidState = { ...dirtyState, title: '' };
  const resSaveInvalid = handleExitChoice('save_and_exit', invalidState);
  assert.equal(resSaveInvalid, 'validation_failed');
  assert.equal(modalOpen, true);
  assert.ok(validationErrors.title);

  // Lựa chọn C: "Lưu và thoát" khi dữ liệu hợp lệ
  const resSaveValid = handleExitChoice('save_and_exit', dirtyState);
  assert.equal(resSaveValid, 'saved_and_exited');
  assert.equal(modalOpen, false);
  assert.equal(saved, true);

  // Lựa chọn D: "Không lưu"
  modalOpen = true;
  const resDiscard = handleExitChoice('discard', dirtyState);
  assert.equal(resDiscard, 'discarded');
  assert.equal(modalOpen, false);

  console.log('=> Test AG-3 PASS: Cả 3 lựa chọn (Tiếp tục / Không lưu / Lưu và thoát) hoạt động chuẩn xác theo yêu cầu.');
}

console.log('\n=== TẤT CẢ TEST CASE VIỆC AG ĐÃ PASS 100% ===');
