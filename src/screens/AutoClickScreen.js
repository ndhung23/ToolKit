import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader } from '../components/ui';
import { useTheme } from '../theme';

export default function AutoClickScreen({ navigation }) {
  const { colors } = useTheme();
  const [running, setRunning] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [intervalMs, setIntervalMs] = useState('500');
  const [targetClicks, setTargetClicks] = useState('100');
  const [mode, setMode] = useState('single'); // 'single' | 'multi'

  const timerRef = useRef(null);

  useEffect(() => {
    if (running) {
      const ms = Math.max(50, parseInt(intervalMs, 10) || 500);
      const max = parseInt(targetClicks, 10) || 100;

      timerRef.current = setInterval(() => {
        setClickCount((prev) => {
          if (prev + 1 >= max) {
            clearInterval(timerRef.current);
            setRunning(false);
            Alert.alert('Hoàn thành', `Đã tự động chạm đủ ${max} lần!`);
            return max;
          }
          return prev + 1;
        });
      }, ms);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running, intervalMs, targetClicks]);

  const toggleRun = () => {
    if (!running) {
      setClickCount(0);
      setRunning(true);
    } else {
      setRunning(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Auto Click"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Target Preview Area */}
      <View style={[styles.previewBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={[styles.targetRing, { borderColor: running ? colors.primary : '#3E3E48' }]}>
          <View style={[styles.targetDot, { backgroundColor: running ? colors.primary : '#3E3E48' }]} />
        </View>
        <Text style={[styles.statusText, { color: running ? colors.primary : colors.sub }]}>
          {running ? 'Đang tự động chạm màn hình...' : 'Điểm chạm mục tiêu (Tọa độ X: 195, Y: 420)'}
        </Text>
        <Text style={styles.counterText}>Số lần đã chạm: {clickCount}</Text>
      </View>

      {/* Cài đặt cấu hình */}
      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={styles.cardHeader}>Cấu hình chu kỳ & tốc độ</Text>

        <View style={styles.inputRow}>
          <Text style={[styles.inputLabel, { color: colors.sub }]}>Thời gian giữa các lần chạm (ms):</Text>
          <TextInput
            value={intervalMs}
            onChangeText={setIntervalMs}
            keyboardType="number-pad"
            disabled={running}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
          />
        </View>

        <View style={styles.inputRow}>
          <Text style={[styles.inputLabel, { color: colors.sub }]}>Số lần chạm giới hạn:</Text>
          <TextInput
            value={targetClicks}
            onChangeText={setTargetClicks}
            keyboardType="number-pad"
            disabled={running}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
          />
        </View>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode('single')}
            style={[
              styles.modeBtn,
              {
                backgroundColor: mode === 'single' ? 'rgba(255, 208, 0, 0.12)' : colors.bg,
                borderColor: mode === 'single' ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={{ color: mode === 'single' ? colors.primary : colors.sub, fontWeight: '700' }}>
              Chạm 1 điểm
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setMode('multi')}
            style={[
              styles.modeBtn,
              {
                backgroundColor: mode === 'multi' ? 'rgba(255, 208, 0, 0.12)' : colors.bg,
                borderColor: mode === 'multi' ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={{ color: mode === 'multi' ? colors.primary : colors.sub, fontWeight: '700' }}>
              Vuốt & Chạm đa điểm
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Nút Bắt đầu / Tạm dừng */}
      <Pressable
        onPress={toggleRun}
        style={[
          styles.actionBtn,
          { backgroundColor: running ? colors.danger : colors.primary },
        ]}
      >
        <Ionicons name={running ? 'pause' : 'play'} size={22} color={running ? '#FFFFFF' : '#121214'} />
        <Text style={[styles.actionBtnText, { color: running ? '#FFFFFF' : '#121214' }]}>
          {running ? 'Dừng Auto Click' : 'Bắt đầu tự động chạm'}
        </Text>
      </Pressable>
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
  previewBox: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  targetRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  targetDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  counterText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  settingsCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    overflow: 'hidden',
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13.5,
    flex: 1,
  },
  input: {
    width: 90,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 999,
    gap: 8,
    overflow: 'hidden',
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
