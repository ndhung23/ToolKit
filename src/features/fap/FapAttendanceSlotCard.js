// src/features/fap/FapAttendanceSlotCard.js
// Thẻ hiển thị một ca học FAP (Slot 1..6, 9) kèm trạng thái điểm danh, Google Meet & Cảnh báo vắng

import React from 'react';
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ATTENDANCE_STATUS } from './fapAttendanceHelper';

export default function FapAttendanceSlotCard({ item, colors }) {
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
            {item.dayName ? `${item.dayName} • ` : ''}
            {item.time}
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
          <Text style={[styles.metaValue, { color: '#F59E0B' }]}>{item.room || 'DE-422'}</Text>
        </View>

        <View style={styles.metaItem}>
          <Ionicons name="person-outline" size={13} color="#3B82F6" />
          <Text style={[styles.metaLabel, { color: colors.sub }]}>GV:</Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>
            {item.lecturer && item.lecturer !== '-' ? item.lecturer : 'Giảng viên'}
          </Text>
        </View>
      </View>

      {/* Nút vào Google Meet nếu là lớp Online có link Meet */}
      {item.meetLink ? (
        <Pressable
          onPress={() => {
            if (item.meetLink) {
              Linking.openURL(item.meetLink);
            }
          }}
          style={[styles.meetLinkBtn, { backgroundColor: '#1A73E8' }]}
          hitSlop={8}
        >
          <Ionicons name="videocam" size={14} color="#FFFFFF" />
          <Text style={styles.meetLinkText}>Vào lớp Google Meet</Text>
          <Ionicons name="open-outline" size={13} color="#FFFFFF" />
        </Pressable>
      ) : null}

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
}

const styles = StyleSheet.create({
  slotCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 10,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slotBadgeText: {
    color: '#121214',
    fontSize: 11.5,
    fontWeight: '900',
  },
  slotTimeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  subjectRow: {
    gap: 2,
  },
  subjectCode: {
    fontSize: 16,
    fontWeight: '900',
  },
  subjectName: {
    fontSize: 12,
  },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
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
  meetLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 2,
  },
  meetLinkText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  absentAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  absentAlertBannerText: {
    color: '#EF4444',
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
});
