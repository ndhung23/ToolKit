import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { styles } from '../microHabitStyles';
import { HABIT_TYPES } from '../microHabitService';

export default function HabitFormModal({
  visible,
  onClose,
  editingId,
  formType,
  setFormType,
  formTitle,
  setFormTitle,
  formErrors,
  setFormErrors,
  formIntervalDays,
  setFormIntervalDays,
  formDayOfMonth,
  setFormDayOfMonth,
  formTargetCount,
  setFormTargetCount,
  formUnit,
  setFormUnit,
  formReminderEnabled,
  setFormReminderEnabled,
  formReminderTime,
  showTimePicker,
  setShowTimePicker,
  pickerDate,
  handleTimePickerChange,
  handleTestNotification,
  formCategory,
  setFormCategory,
  customCategories,
  setCustomCategories,
  saveCustomCategories,
  formCustomCategory,
  setFormCustomCategory,
  formNote,
  setFormNote,
  formColor,
  setFormColor,
  handleSaveForm,
  isFormValid,
  colors,
  t,
  intervalPresets = [7, 14, 30, 60, 90, 180, 365],
  dailyPresets = [1, 2, 4, 8, 10],
  dailyUnits = ['lần', 'cốc', 'viên', 'km'],
  categories = ['Sinh hoạt', 'Xe cộ', 'Nhà cửa', 'Tài chính', 'Sức khỏe', 'Khác'],
  daysOfMonth = Array.from({ length: 31 }, (_, i) => i + 1),
  presetColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'],
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingId
                ? (t ? t('microHabit.editHabit') : 'Chỉnh sửa việc vặt')
                : (t ? t('microHabit.addHabitTitle') : 'Thêm việc vặt & Chu kỳ mới')}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.sub} />
            </Pressable>
          </View>

          <FlatList
            data={[{ key: 'form-body' }]}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={() => (
              <View style={styles.formContainer}>
                {/* Chọn loại chu kỳ */}
                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  {t ? t('microHabit.cycleType') : 'Loại chu kỳ lặp'}
                </Text>
                <View style={styles.typeSelectorRow}>
                  {[
                    { type: HABIT_TYPES.INTERVAL, label: t ? t('microHabit.cycleByDay') : 'Theo ngày 🔄' },
                    { type: HABIT_TYPES.MONTHLY, label: t ? t('microHabit.cycleMonthly') : 'Hàng tháng 📅' },
                    { type: HABIT_TYPES.DAILY, label: t ? t('microHabit.cycleDaily') : 'Trong ngày 🎯' },
                  ].map((item) => (
                    <Pressable
                      key={item.type}
                      onPress={() => setFormType(item.type)}
                      style={[
                        styles.typeBtn,
                        {
                          backgroundColor: formType === item.type ? '#10B981' : colors.cardElevated,
                          borderColor: formType === item.type ? '#10B981' : colors.cardBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.typeBtnText, { color: formType === item.type ? '#FFFFFF' : colors.text }]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Tên việc */}
                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  {t ? t('microHabit.habitName') : 'Tên việc vặt / Thói quen'}
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: formErrors.title ? '#EF4444' : colors.border }]}
                  value={formTitle}
                  onChangeText={(val) => { setFormTitle(val); setFormErrors((e) => ({ ...e, title: undefined })); }}
                  placeholder="VD: Thay nhớt xe, Đóng tiền trọ, Uống thuốc..."
                  placeholderTextColor={colors.sub}
                  autoCapitalize="sentences"
                  maxLength={60}
                />
                <Text style={[styles.charCount, { color: colors.sub }]}>{formTitle.length}/60</Text>
                {formErrors.title ? <Text style={styles.errorText}>{formErrors.title}</Text> : null}

                {/* Tham số chu kỳ */}
                {formType === HABIT_TYPES.INTERVAL && (
                  <View style={styles.formSectionBox}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>
                      {t ? t('microHabit.everyNDays') : 'Chu kỳ lặp lại (ngày)'}
                    </Text>
                    {/* Chips chọn nhanh */}
                    <View style={styles.chipRow}>
                      {intervalPresets.map((days) => {
                        const isSelected = parseInt(formIntervalDays, 10) === days;
                        return (
                          <Pressable
                            key={days}
                            onPress={() => {
                              setFormIntervalDays(String(days));
                              setFormErrors((e) => ({ ...e, intervalDays: undefined }));
                            }}
                            style={[
                              styles.presetChip,
                              {
                                backgroundColor: isSelected ? '#10B981' : colors.cardElevated,
                                borderColor: isSelected ? '#10B981' : colors.cardBorder,
                              },
                            ]}
                          >
                            <Text style={[styles.presetChipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                              {days} ngày
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Stepper */}
                    <View style={styles.stepperContainer}>
                      <Pressable
                        onPress={() => setFormIntervalDays((prev) => String(Math.max(1, parseInt(prev || '1', 10) - 5)))}
                        style={[styles.stepperMiniBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                      >
                        <Text style={[styles.stepperMiniBtnText, { color: colors.text }]}>-5</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setFormIntervalDays((prev) => String(Math.max(1, parseInt(prev || '1', 10) - 1)))}
                        style={[styles.stepperMiniBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                      >
                        <Ionicons name="remove" size={18} color={colors.text} />
                      </Pressable>

                      <View style={[styles.stepperDisplay, { backgroundColor: colors.card, borderColor: '#10B981' }]}>
                        <Text style={[styles.stepperDisplayText, { color: colors.text }]}>
                          {formIntervalDays} <Text style={{ fontSize: 13, color: colors.sub }}>ngày</Text>
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => setFormIntervalDays((prev) => String(Math.min(3650, parseInt(prev || '1', 10) + 1)))}
                        style={[styles.stepperMiniBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                      >
                        <Ionicons name="add" size={18} color={colors.text} />
                      </Pressable>
                      <Pressable
                        onPress={() => setFormIntervalDays((prev) => String(Math.min(3650, parseInt(prev || '1', 10) + 5)))}
                        style={[styles.stepperMiniBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                      >
                        <Text style={[styles.stepperMiniBtnText, { color: colors.text }]}>+5</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {formType === HABIT_TYPES.MONTHLY && (
                  <View style={styles.formSectionBox}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>
                      {t ? t('microHabit.dayOfMonth') : 'Ngày đến hạn hàng tháng (Chọn 1 trong 31 ngày)'}
                    </Text>
                    <View style={styles.daysGrid}>
                      {daysOfMonth.map((d) => {
                        const isSelected = parseInt(formDayOfMonth, 10) === d;
                        return (
                          <Pressable
                            key={d}
                            onPress={() => {
                              setFormDayOfMonth(String(d));
                              setFormErrors((e) => ({ ...e, dayOfMonth: undefined }));
                            }}
                            style={[
                              styles.dayGridCell,
                              {
                                backgroundColor: isSelected ? '#10B981' : colors.cardElevated,
                                borderColor: isSelected ? '#10B981' : colors.cardBorder,
                              },
                            ]}
                          >
                            <Text style={[styles.dayGridCellText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                              {d}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={[styles.noteBox, { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder }]}>
                      <Ionicons name="information-circle-outline" size={16} color="#10B981" />
                      <Text style={[styles.noteBoxText, { color: colors.sub }]}>
                        Với tháng ngắn (tháng 2, 4, 6, 9, 11), hệ thống sẽ tự động chọn ngày cuối cùng của tháng đó.
                      </Text>
                    </View>
                  </View>
                )}

                {formType === HABIT_TYPES.DAILY && (
                  <View style={styles.formSectionBox}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>
                      {t ? t('microHabit.dailyTarget') : 'Mục tiêu số lần mỗi ngày'}
                    </Text>
                    <View style={styles.chipRow}>
                      {dailyPresets.map((cnt) => {
                        const isSelected = parseInt(formTargetCount, 10) === cnt;
                        return (
                          <Pressable
                            key={cnt}
                            onPress={() => {
                              setFormTargetCount(String(cnt));
                              setFormErrors((e) => ({ ...e, targetCount: undefined }));
                            }}
                            style={[
                              styles.presetChip,
                              {
                                backgroundColor: isSelected ? '#10B981' : colors.cardElevated,
                                borderColor: isSelected ? '#10B981' : colors.cardBorder,
                              },
                            ]}
                          >
                            <Text style={[styles.presetChipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                              {cnt} lần
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <View style={styles.stepperContainer}>
                      <Pressable
                        onPress={() => setFormTargetCount((prev) => String(Math.max(1, parseInt(prev || '1', 10) - 1)))}
                        style={[styles.stepperMiniBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                      >
                        <Ionicons name="remove" size={18} color={colors.text} />
                      </Pressable>
                      <View style={[styles.stepperDisplay, { backgroundColor: colors.card, borderColor: '#10B981' }]}>
                        <Text style={[styles.stepperDisplayText, { color: colors.text }]}>
                          {formTargetCount} <Text style={{ fontSize: 13, color: colors.sub }}>{formUnit || 'lần'}</Text>
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setFormTargetCount((prev) => String(Math.min(9999, parseInt(prev || '1', 10) + 1)))}
                        style={[styles.stepperMiniBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                      >
                        <Ionicons name="add" size={18} color={colors.text} />
                      </Pressable>
                    </View>

                    <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 8 }]}>Đơn vị tính</Text>
                    <View style={styles.chipWrap}>
                      {dailyUnits.map((u) => (
                        <Pressable
                          key={u}
                          onPress={() => setFormUnit(u)}
                          style={[
                            styles.choiceChip,
                            {
                              borderColor: formUnit === u ? '#10B981' : colors.border,
                              backgroundColor: formUnit === u ? 'rgba(16,185,129,0.15)' : colors.card,
                            },
                          ]}
                        >
                          <Text style={{ color: formUnit === u ? '#10B981' : colors.sub, fontWeight: '700' }}>{u}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {/* THIẾT LẬP THÔNG BÁO NHẮC NHỞ */}
                <View style={[styles.reminderSection, { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder }]}>
                  <View style={styles.reminderHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="notifications" size={18} color="#10B981" />
                      <Text style={[styles.reminderSectionTitle, { color: colors.text }]}>
                        {t ? t('microHabit.enableReminder') : 'Nhắc nhở theo giờ (Tùy chọn)'}
                      </Text>
                    </View>
                    <Switch
                      value={formReminderEnabled}
                      onValueChange={setFormReminderEnabled}
                      trackColor={{ false: colors.cardBorder, true: '#10B981' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {formReminderEnabled && (
                    <View style={styles.reminderBody}>
                      <Text style={[styles.subPickerTitle, { color: colors.text }]}>
                        {t ? t('microHabit.reminderTime') : 'Khung giờ báo thức'}
                      </Text>
                      <Pressable
                        onPress={() => setShowTimePicker(true)}
                        style={[styles.timePickerBtn, { backgroundColor: colors.card, borderColor: '#10B981' }]}
                      >
                        <Ionicons name="alarm-outline" size={26} color="#10B981" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.timePickerVal, { color: colors.text }]}>
                            {formReminderTime}
                          </Text>
                          <Text style={[styles.timePickerSub, { color: colors.sub }]}>
                            {formType === HABIT_TYPES.DAILY ? 'Báo mỗi ngày lúc giờ này' : 'Báo vào ngày đến hạn lúc giờ này'}
                          </Text>
                        </View>
                        <View style={[styles.changeTimeBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                          <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700' }}>Đổi giờ</Text>
                        </View>
                      </Pressable>

                      {showTimePicker && (
                        Platform.OS === 'ios' ? (
                          <Modal visible={showTimePicker} transparent animationType="fade">
                            <View style={styles.timePickerModalOverlay}>
                              <View style={[styles.timePickerModalBox, { backgroundColor: colors.card }]}>
                                <View style={styles.timePickerModalHeader}>
                                  <Text style={[styles.timePickerModalTitle, { color: colors.text }]}>Chọn giờ nhắc</Text>
                                  <Pressable onPress={() => setShowTimePicker(false)}>
                                    <Ionicons name="close" size={22} color={colors.sub} />
                                  </Pressable>
                                </View>
                                <DateTimePicker
                                  value={pickerDate}
                                  mode="time"
                                  is24Hour
                                  display="spinner"
                                  textColor={colors.text}
                                  onChange={handleTimePickerChange}
                                />
                                <Pressable
                                  onPress={() => setShowTimePicker(false)}
                                  style={[styles.timePickerModalDone, { backgroundColor: '#10B981' }]}
                                >
                                  <Text style={styles.timePickerModalDoneText}>Xác nhận giờ</Text>
                                </Pressable>
                              </View>
                            </View>
                          </Modal>
                        ) : (
                          <DateTimePicker
                            value={pickerDate}
                            mode="time"
                            is24Hour
                            display="default"
                            onChange={handleTimePickerChange}
                          />
                        )
                      )}

                      <Pressable
                        onPress={handleTestNotification}
                        style={[styles.testNotifBtn, { backgroundColor: colors.card, borderColor: '#10B981' }]}
                      >
                        <Ionicons name="notifications-circle" size={18} color="#10B981" />
                        <Text style={styles.testNotifBtnText}>🔔 {t ? t('microHabit.testNotif') : 'Thử chuông thông báo ngay (2s)'}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                {/* Danh mục */}
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Nhóm / Danh mục</Text>
                <View style={styles.chipWrap}>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => { setFormCategory(cat); setFormErrors((e) => ({ ...e, category: undefined })); }}
                      style={[
                        styles.choiceChip,
                        {
                          borderColor: formCategory === cat ? '#10B981' : colors.border,
                          backgroundColor: formCategory === cat ? 'rgba(16,185,129,0.15)' : colors.card,
                        },
                      ]}
                    >
                      <Text style={{ color: formCategory === cat ? '#10B981' : colors.sub, fontWeight: '700' }}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>

                {customCategories.length ? (
                  <View style={styles.customCategoryRow}>
                    {customCategories.map((cat) => (
                      <View key={cat} style={[styles.choiceChip, { flexDirection: 'row', gap: 4, borderColor: colors.border }]}>
                        <Pressable onPress={() => { setFormCategory('Khác'); setFormCustomCategory(cat); }}>
                          <Text style={{ color: colors.sub, fontWeight: '700' }}>{cat}</Text>
                        </Pressable>
                        <Pressable
                          onPress={async () => {
                            const next = customCategories.filter((item) => item !== cat);
                            setCustomCategories(next);
                            if (saveCustomCategories) await saveCustomCategories(next);
                          }}
                          hitSlop={6}
                        >
                          <Ionicons name="close" size={14} color={colors.sub} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                {formCategory === 'Khác' ? (
                  <>
                    <TextInput
                      autoFocus
                      value={formCustomCategory}
                      onChangeText={(text) => { setFormCustomCategory(text); setFormErrors((e) => ({ ...e, category: undefined })); }}
                      maxLength={20}
                      placeholder="Tên danh mục"
                      placeholderTextColor={colors.sub}
                      style={[styles.input, { color: colors.text, borderColor: formErrors.category ? '#EF4444' : colors.border, marginTop: 8 }]}
                    />
                    {formErrors.category ? <Text style={styles.errorText}>{formErrors.category}</Text> : null}
                  </>
                ) : null}

                {/* Ghi chú */}
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Ghi chú thêm</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={formNote}
                  onChangeText={setFormNote}
                  placeholder="VD: Nhớt 10W40, STK chủ nhà..."
                  placeholderTextColor={colors.sub}
                />

                {/* Chọn màu sắc */}
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Màu đại diện</Text>
                <View style={styles.colorPalette}>
                  {presetColors.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setFormColor(c)}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c },
                        formColor === c && styles.colorCircleSelected,
                      ]}
                    />
                  ))}
                </View>

                {/* Nút Submit */}
                <Pressable
                  onPress={handleSaveForm}
                  disabled={!isFormValid}
                  style={[styles.saveBtn, { backgroundColor: isFormValid ? '#10B981' : '#6B7280', opacity: isFormValid ? 1 : 0.5 }]}
                >
                  <Text style={styles.saveBtnText}>
                    {editingId
                      ? (t ? t('microHabit.updateHabit') : 'Cập nhật việc vặt')
                      : (t ? t('microHabit.saveHabit') : 'Lưu việc vặt mới')}
                  </Text>
                </Pressable>
                <View style={{ height: 20 }} />
              </View>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
