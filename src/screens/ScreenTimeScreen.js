import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader } from '../components/ui';
import { useTheme } from '../theme';

const APPS_USAGE = [
  { id: 'fb', name: 'Facebook', usedMinutes: 65, limitMinutes: 90, icon: 'logo-facebook', color: '#1877F2' },
  { id: 'tt', name: 'TikTok', usedMinutes: 45, limitMinutes: 60, icon: 'videocam', color: '#010101' },
  { id: 'yt', name: 'YouTube', usedMinutes: 30, limitMinutes: 60, icon: 'logo-youtube', color: '#FF0000' },
  { id: 'game', name: 'Trò chơi', usedMinutes: 20, limitMinutes: 45, icon: 'game-controller', color: '#10B981' },
];

export default function ScreenTimeScreen({ navigation }) {
  const { colors } = useTheme();
  const [remindEnabled, setRemindEnabled] = useState(true);
  const [remindInterval, setRemindInterval] = useState(45); // phút

  const totalUsed = APPS_USAGE.reduce((sum, a) => sum + a.usedMinutes, 0);

  const handleSetRemind = (mins) => {
    setRemindInterval(mins);
    Alert.alert('Đã cập nhật', `ToolKit sẽ nhắc nhở bạn nghỉ ngơi sau mỗi ${mins} phút sử dụng liên tục.`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Thời gian sử dụng"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Banner thời gian sử dụng hôm nay */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardSub, { color: colors.sub }]}>Thời gian sử dụng hôm nay</Text>
        <Text style={[styles.bigTime, { color: colors.primary }]}>
          {Math.floor(totalUsed / 60)}h {totalUsed % 60}p
        </Text>
        <Text style={[styles.cardHint, { color: colors.sub }]}>
          Giảm 25 phút so với hôm qua • Trạng thái: Ổn định
        </Text>
      </View>

      {/* Cài đặt nhắc nhở */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.remindHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.remindTitle}>Cảnh báo dùng máy liên tục</Text>
            <Text style={[styles.remindDesc, { color: colors.sub }]}>
              Rung và phát thông báo nhắc nhở mắt nghỉ ngơi
            </Text>
          </View>
          <Switch
            value={remindEnabled}
            onValueChange={setRemindEnabled}
            trackColor={{ false: '#3A3A42', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {remindEnabled && (
          <View style={styles.intervalOptions}>
            {[30, 45, 60, 90].map((mins) => (
              <Pressable
                key={mins}
                onPress={() => handleSetRemind(mins)}
                style={[
                  styles.intervalPill,
                  {
                    backgroundColor: remindInterval === mins ? 'rgba(255, 208, 0, 0.12)' : colors.bg,
                    borderColor: remindInterval === mins ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: remindInterval === mins ? colors.primary : colors.sub,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  {mins} phút
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Chi tiết theo ứng dụng */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Chi tiết ứng dụng</Text>

      {APPS_USAGE.map((app) => {
        const percent = Math.min(100, Math.round((app.usedMinutes / app.limitMinutes) * 100));
        return (
          <View
            key={app.id}
            style={[styles.appItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <View style={[styles.appIconBox, { backgroundColor: app.color + '22' }]}>
              <Ionicons name={app.icon} size={22} color={app.color} />
            </View>

            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <View style={styles.appTitleRow}>
                <Text style={styles.appName}>{app.name}</Text>
                <Text style={[styles.appDuration, { color: colors.sub }]}>
                  {app.usedMinutes}p / {app.limitMinutes}p
                </Text>
              </View>

              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${percent}%`,
                      backgroundColor: percent > 85 ? colors.danger : colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardSub: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  bigTime: {
    fontSize: 38,
    fontWeight: '900',
    marginVertical: 6,
    letterSpacing: -0.5,
  },
  cardHint: {
    fontSize: 13,
  },
  remindHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  remindTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  remindDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  intervalOptions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  intervalPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginVertical: 12,
  },
  appItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  appIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  appName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  appDuration: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressBar: {
    height: 5,
    backgroundColor: '#35353E',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
