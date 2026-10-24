// src/screens/tools/fap/FapAttendanceView.js
// Giao diện Điểm danh FAP - Tập trung kiểm tra ca học Hôm nay (Today) & Cảnh báo vắng (+10p)

import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Switch,
  StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ATTENDANCE_STATUS,
  getCurrentVietnamDayInfo,
  filterSlotsForToday,
  getNextUpcomingSlot,
  triggerAbsentNotification,
  SAMPLE_TODAY_SLOTS,
} from '../../../utils/fapAttendanceHelper';

export default function FapAttendanceView({
  colors,
  weeklySlots = [],
  todaySlots: propTodaySlots = [],
  absentAlertEnabled = true,
  onToggleAbsentAlert,
  onSyncAttendance,
  onSimulateAbsentAlert,
  headerComponent = null,
}) {
  const [viewMode, setViewMode] = useState('today'); // 'today' | 'week'
  const dayInfo = getCurrentVietnamDayInfo();

  // Nhận dữ liệu ca học từ cả weeklySlots hoặc propTodaySlots
  const allWeeklySlots =
    Array.isArray(weeklySlots) && weeklySlots.length > 0
      ? weeklySlots
      : Array.isArray(propTodaySlots)
      ? propTodaySlots
      : [];

  const todayClasses = filterSlotsForToday(allWeeklySlots);
  const nextClass = getNextUpcomingSlot(allWeeklySlots);

  // Thống kê nhanh điểm danh hôm nay
  const presentCount = todayClasses.filter(
    (s) => s.status === ATTENDANCE_STATUS.PRESENT || s.status?.toLowerCase() === 'present'
  ).length;
  const absentCount = todayClasses.filter(
    (s) => s.status === ATTENDANCE_STATUS.ABSENT || s.status?.toLowerCase() === 'absent'
  ).length;
  const notYetCount = todayClasses.length - presentCount - absentCount;

  const displaySlots = viewMode === 'today' ? todayClasses : allWeeklySlots;

  const renderSlotCard = ({ item }) => {
    const isAbsent =
      item.status === ATTENDANCE_STATUS.ABSENT ||
      item.status?.toLowerCase() === 'absent' ||
      item.status?.toLowerCase() === 'vắng' ||
      item.status?.toLowerCase() === 'vắng mặt';
    const isPresent =
      item.status === ATTENDANCE_STATUS.PRESENT ||
      item.status?.toLowerCase() === 'present' ||
      item.status?.toLowerCase() === 'có mặt';

    let badgeBg = 'rgba(245, 158, 11, 0.12)';
    let badgeBorder = 'rgba(245, 158, 11, 0.3)';
    let badgeText = '#F59E0B';
    let statusLabel = 'Chưa điểm danh';
    let iconName = 'time-outline';

    if (isAbsent) {
      badgeBg = 'rgba(239, 68, 68, 0.15)';
      badgeBorder = '#EF4444';
      badgeText = '#EF4444';
      statusLabel = 'VẮNG MẶT (ABSENT)';
      iconName = 'alert-circle';
    } else if (isPresent) {
      badgeBg = 'rgba(16, 185, 129, 0.15)';
      badgeBorder = '#10B981';
      badgeText = '#10B981';
      statusLabel = 'Có mặt (Present)';
      iconName = 'checkmark-circle';
    }

    return (
      <View
        style={[
          styles.slotCard,
          {
            backgroundColor: colors.card,
            borderColor: isAbsent ? '#EF4444' : colors.cardBorder,
            borderWidth: isAbsent ? 1.5 : 1,
          },
        ]}
      >
        {/* Hàng 1: Slot + Thời gian + Badge trạng thái */}
        <View style={styles.slotTopRow}>
          <View style={styles.slotBadgeWrap}>
            <View style={[styles.slotBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.slotBadgeText}>SLOT {item.slot}</Text>
            </View>
            <Text style={[styles.slotTimeText, { color: colors.sub }]}>
              {item.dayName ? `${item.dayName} • ` : ''}{item.time}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
            <Ionicons name={iconName} size={13} color={badgeText} />
            <Text style={[styles.statusBadgeText, { color: badgeText }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Hàng 2: Tên môn & Mã môn */}
        <View style={styles.subjectRow}>
          <Text style={[styles.subjectCode, { color: colors.text }]}>{item.subjectCode}</Text>
          {item.subjectName && item.subjectName !== item.subjectCode ? (
            <Text style={[styles.subjectName, { color: colors.sub }]} numberOfLines={1}>
              {item.subjectName}
            </Text>
          ) : null}
        </View>

        {/* Hàng 3: Phòng học & Giảng viên */}
        <View style={[styles.metaBar, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={13} color="#F59E0B" />
            <Text style={[styles.metaLabel, { color: colors.sub }]}>Phòng:</Text>
            <Text style={[styles.metaValue, { color: '#F59E0B' }]}>{item.room || 'BE-212'}</Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={13} color="#3B82F6" />
            <Text style={[styles.metaLabel, { color: colors.sub }]}>GV:</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>{item.lecturer || 'Giảng viên'}</Text>
          </View>
        </View>

        {/* Cảnh báo vắng nếu bị Absent */}
        {isAbsent && (
          <View style={styles.absentAlertBanner}>
            <Ionicons name="notifications" size={14} color="#EF4444" />
            <Text style={styles.absentAlertBannerText}>
              Báo chuông máy lúc <Text style={{ fontWeight: '800' }}>{item.alertTime} (+10p)</Text> do bị đánh Vắng!
            </Text>
          </View>
        )}
      </View>
    );
  };

  const ListHeader = () => (
    <View style={styles.headerWrap}>
      {headerComponent}

      {/* 1. THANH CHUYỂN CHẾ ĐỘ XEM: [Hôm nay] vs [Cả tuần] */}
      <View style={[styles.modeTabContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          onPress={() => setViewMode('today')}
          style={[
            styles.modeTabBtn,
            viewMode === 'today' && { backgroundColor: colors.primary },
          ]}
        >
          <Ionicons
            name="today"
            size={14}
            color={viewMode === 'today' ? '#121214' : colors.sub}
          />
          <Text
            style={[
              styles.modeTabText,
              { color: viewMode === 'today' ? '#121214' : colors.sub },
            ]}
          >
            Hôm nay ({todayClasses.length} ca)
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setViewMode('week')}
          style={[
            styles.modeTabBtn,
            viewMode === 'week' && { backgroundColor: colors.primary },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={14}
            color={viewMode === 'week' ? '#121214' : colors.sub}
          />
          <Text
            style={[
              styles.modeTabText,
              { color: viewMode === 'week' ? '#121214' : colors.sub },
            ]}
          >
            Cả tuần ({allWeeklySlots.length} ca)
          </Text>
        </Pressable>
      </View>

      {/* 2. THẺ CÀI ĐẶT CẢNH BÁO VẮNG (+10P SAU CA HỌC) */}
      <View style={[styles.alertConfigCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.alertConfigTopRow}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="notifications-outline" size={17} color={colors.primary} />
              <Text style={[styles.alertConfigTitle, { color: colors.text }]}>
                Cảnh báo vắng (+10p sau ca học)
              </Text>
            </View>
            <Text style={[styles.alertConfigSub, { color: colors.sub }]}>
              Rung chuông & gửi thông báo đúng 10 phút sau ca học nếu bị đánh Vắng (Absent)
            </Text>
          </View>
          <Switch
            value={absentAlertEnabled}
            onValueChange={onToggleAbsentAlert}
            trackColor={{ false: '#3E3E42', true: colors.primary }}
            thumbColor={absentAlertEnabled ? '#121214' : '#9E9EA7'}
          />
        </View>

        <View style={styles.configActionsRow}>
          <Pressable
            onPress={() => {
              if (onSimulateAbsentAlert) {
                onSimulateAbsentAlert();
              } else if (todayClasses.length > 0) {
                const target =
                  todayClasses.find((s) => s.status === ATTENDANCE_STATUS.ABSENT) || todayClasses[0];
                triggerAbsentNotification(target);
              } else {
                triggerAbsentNotification(SAMPLE_TODAY_SLOTS[1]);
              }
            }}
            style={[styles.testAlertBtn, { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)' }]}
          >
            <Ionicons name="volume-high-outline" size={14} color="#EF4444" />
            <Text style={[styles.testAlertBtnText, { color: '#EF4444' }]}>Thử chuông cảnh báo</Text>
          </Pressable>

          <Pressable
            onPress={onSyncAttendance}
            style={[styles.testAlertBtn, { backgroundColor: '#10B981', borderColor: '#10B981', flex: 1.2 }]}
          >
            <Ionicons name="refresh-outline" size={14} color="#FFFFFF" />
            <Text style={[styles.testAlertBtnText, { color: '#FFFFFF' }]}>Cập nhật từ FAP</Text>
          </Pressable>
        </View>
      </View>

      {/* 3. TIÊU ĐỀ SECTION & TỔNG QUAN HÔM NAY */}
      <View style={styles.sectionTitleRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons
            name={viewMode === 'today' ? 'today' : 'calendar'}
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.sectionTitleText, { color: colors.text }]}>
            {viewMode === 'today'
              ? `Điểm danh hôm nay (${dayInfo.fullDateStr})`
              : `Thời khóa biểu cả tuần (${allWeeklySlots.length} ca)`}
          </Text>
        </View>
      </View>

      {/* NẾU XEM HÔM NAY VÀ HÔM NAY CÓ CA HỌC -> THANH TÓM TẮT TRẠNG THÁI */}
      {viewMode === 'today' && todayClasses.length > 0 ? (
        <View style={styles.todayStatsRow}>
          <View style={[styles.statChip, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <Text style={[styles.statChipNumber, { color: '#10B981' }]}>{presentCount}</Text>
            <Text style={[styles.statChipLabel, { color: '#10B981' }]}>Có mặt</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
            <Text style={[styles.statChipNumber, { color: '#EF4444' }]}>{absentCount}</Text>
            <Text style={[styles.statChipLabel, { color: '#EF4444' }]}>Vắng mặt</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
            <Text style={[styles.statChipNumber, { color: '#F59E0B' }]}>{notYetCount}</Text>
            <Text style={[styles.statChipLabel, { color: '#F59E0B' }]}>Chưa điểm danh</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={displaySlots}
      keyExtractor={(item) => item.id}
      renderItem={renderSlotCard}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        viewMode === 'today' && allWeeklySlots.length > 0 ? (
          /* TRƯỜNG HỢP 1: Hôm nay không có ca học nào trên FAP nhưng cả tuần đã có TKB */
          <View style={[styles.dayOffCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.dayOffIconWrap}>
              <Ionicons name="sunny-outline" size={32} color="#10B981" />
            </View>
            <Text style={[styles.dayOffTitle, { color: colors.text }]}>
              Hôm nay bạn không có lịch học! 🎉
            </Text>
            <Text style={[styles.dayOffDesc, { color: colors.sub }]}>
              Hôm nay ({dayInfo.fullDateStr}) không có ca học nào cần điểm danh. Hãy nghỉ ngơi hoặc tự học nhé!
            </Text>

            {nextClass ? (
              <View style={[styles.upcomingClassCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.upcomingClassTitle, { color: colors.text }]}>
                    Ca học tiếp theo: {nextClass.dayName}
                  </Text>
                  <Text style={[styles.upcomingClassDetails, { color: colors.sub }]}>
                    Slot {nextClass.slot} ({nextClass.time}) • Môn {nextClass.subjectCode} tại phòng {nextClass.room}
                  </Text>
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={() => setViewMode('week')}
              style={[styles.switchWeekBtn, { borderColor: colors.primary }]}
            >
              <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: '800' }}>
                Xem thời khóa biểu cả tuần ({allWeeklySlots.length} ca)
              </Text>
            </Pressable>
          </View>
        ) : (
          /* TRƯỜNG HỢP 2: Chưa cào TKB lần nào */
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Ionicons name="calendar-clear-outline" size={40} color={colors.sub} />
            <Text style={[styles.emptyCardTitle, { color: colors.text }]}>
              Chưa có dữ liệu Thời khóa biểu & Điểm danh
            </Text>
            <Text style={[styles.emptyCardDesc, { color: colors.sub }]}>
              Nhấn "Cập nhật từ FAP" để mở https://fap.fpt.edu.vn/WeeklyTimetable và tự động lấy danh sách ca học tuần này.
            </Text>
            <Pressable
              onPress={onSyncAttendance}
              style={[styles.syncTimetableBtn, { backgroundColor: '#10B981' }]}
            >
              <Ionicons name="globe-outline" size={16} color="#FFFFFF" />
              <Text style={styles.syncTimetableBtnText}>Cập nhật Thời khóa biểu từ FAP</Text>
            </Pressable>
          </View>
        )
      }
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={8}
      ListFooterComponent={<View style={{ height: 40 }} />}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerWrap: {
    marginBottom: 10,
    gap: 12,
  },
  modeTabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  modeTabText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  alertConfigCard: {
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  alertConfigTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertConfigTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  alertConfigSub: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  configActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  testAlertBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  testAlertBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  todayStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  statChipNumber: {
    fontSize: 15,
    fontWeight: '900',
  },
  statChipLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 1,
  },
  slotCard: {
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    gap: 8,
  },
  slotTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slotBadgeText: {
    color: '#121214',
    fontSize: 10.5,
    fontWeight: '900',
  },
  slotTimeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  subjectRow: {
    marginTop: 2,
  },
  subjectCode: {
    fontSize: 16,
    fontWeight: '900',
  },
  subjectName: {
    fontSize: 12,
    marginTop: 2,
  },
  metaBar: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: 9,
    borderWidth: 1,
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
  },
  metaValue: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  absentAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    padding: 8,
    borderRadius: 8,
  },
  absentAlertBannerText: {
    color: '#EF4444',
    fontSize: 11.5,
  },
  dayOffCard: {
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  dayOffIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayOffTitle: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  dayOffDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  upcomingClassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    marginTop: 6,
  },
  upcomingClassTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  upcomingClassDetails: {
    fontSize: 11.5,
    marginTop: 2,
  },
  switchWeekBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9,
    borderWidth: 1,
    marginTop: 6,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  emptyCardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyCardDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  syncTimetableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 6,
  },
  syncTimetableBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12.5,
  },
});
