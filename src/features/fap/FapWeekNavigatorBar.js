// src/features/fap/FapWeekNavigatorBar.js
// Thanh điều hướng tuần (Tuần trước / Tuần này / Tuần sau) kèm các chip lọc Thứ trong tuần

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function FapWeekNavigatorBar({
  colors,
  weekOffset,
  weekInfo,
  allWeeklySlots = [],
  selectedDayFilter = 'all',
  onPrevWeek,
  onNextWeek,
  onCurrentWeek,
  onSelectDayFilter,
}) {
  return (
    <View style={[styles.weekNavContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      {/* Hàng 1: Nút Tuần trước, Badge Tuần hiện tại, Nút Tuần sau */}
      <View style={styles.weekNavControlsRow}>
        <Pressable
          onPress={onPrevWeek}
          style={[styles.weekNavBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={16} color={colors.text} />
          <Text style={[styles.weekNavBtnText, { color: colors.text }]}>Tuần trước</Text>
        </Pressable>

        <Pressable
          onPress={onCurrentWeek}
          style={[
            styles.weekLabelBadge,
            {
              backgroundColor:
                weekOffset === 0
                  ? 'rgba(16, 185, 129, 0.12)'
                  : 'rgba(59, 130, 246, 0.12)',
              borderColor: weekOffset === 0 ? '#10B981' : '#3B82F6',
            },
          ]}
        >
          <Ionicons
            name="calendar"
            size={14}
            color={weekOffset === 0 ? '#10B981' : '#3B82F6'}
          />
          <Text
            style={[
              styles.weekLabelText,
              { color: weekOffset === 0 ? '#10B981' : '#3B82F6' },
            ]}
          >
            {weekInfo.weekLabel}
          </Text>
          {weekOffset !== 0 ? (
            <View style={styles.returnTodayDot}>
              <Text style={styles.returnTodayText}>• Về tuần này</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          onPress={onNextWeek}
          style={[styles.weekNavBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}
          hitSlop={8}
        >
          <Text style={[styles.weekNavBtnText, { color: colors.text }]}>Tuần sau</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.text} />
        </Pressable>
      </View>

      {/* Hàng 2: Chip lọc Thứ trong tuần (Tất cả, T2, T3, T4, T5, T6, T7, CN) */}
      <View style={styles.dayFilterRow}>
        <Pressable
          onPress={() => onSelectDayFilter('all')}
          style={[
            styles.dayFilterChip,
            selectedDayFilter === 'all'
              ? { backgroundColor: '#10B981', borderColor: '#10B981' }
              : { backgroundColor: colors.bg, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.dayFilterChipText,
              { color: selectedDayFilter === 'all' ? '#FFFFFF' : colors.sub },
            ]}
          >
            Cả tuần ({allWeeklySlots.length})
          </Text>
        </Pressable>

        {weekInfo.days.map((day) => {
          const count = allWeeklySlots.filter((s) => s.dayIndex === day.dayIndex).length;
          const isSelected = selectedDayFilter === day.dayIndex;
          return (
            <Pressable
              key={day.dayIndex}
              onPress={() => onSelectDayFilter(day.dayIndex)}
              style={[
                styles.dayFilterChip,
                isSelected
                  ? { backgroundColor: '#10B981', borderColor: '#10B981' }
                  : day.isToday
                    ? { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: '#3B82F6' }
                    : { backgroundColor: colors.bg, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.dayFilterChipText,
                  {
                    color: isSelected
                      ? '#FFFFFF'
                      : day.isToday
                        ? '#3B82F6'
                        : colors.text,
                    fontWeight: isSelected || day.isToday ? '800' : '500',
                  },
                ]}
              >
                {day.dayName.replace('Thứ ', 'T')}
                {count > 0 ? ` (${count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekNavContainer: {
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  weekNavControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  weekNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  weekNavBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  weekLabelBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  weekLabelText: {
    fontSize: 12,
    fontWeight: '800',
  },
  returnTodayDot: {
    marginLeft: 2,
  },
  returnTodayText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#3B82F6',
  },
  dayFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  dayFilterChip: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
  },
  dayFilterChipText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
});
