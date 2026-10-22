import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Alert, ScrollView, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader } from '../../components/ui';
import { useTheme } from '../../theme';

const BANKS = [
  { id: 'vcb', name: 'Vietcombank', code: 'VCB' },
  { id: 'mb', name: 'MBBank', code: 'MB' },
  { id: 'tcb', name: 'Techcombank', code: 'TCB' },
  { id: 'momo', name: 'Ví MoMo', code: 'MOMO' },
];

export default function QrTransferScreen({ navigation }) {
  const { colors } = useTheme();
  const [step, setStep] = useState(1); // 1: Quét QR -> 2: Nhập tiền & note -> 3: Chuyển sang app ngân hàng
  const [qrScanned, setQrScanned] = useState(false);
  const [accountInfo, setAccountInfo] = useState({ bank: 'MBBank', accNum: '0388889999', name: 'NGUYEN VAN A' });
  const [amount, setAmount] = useState('250000');
  const [note, setNote] = useState('Chuyen khoan thanh toan');
  const [selectedBank, setSelectedBank] = useState('mb');

  const handleScanQr = () => {
    // Giả lập quét QR thành công
    setQrScanned(true);
    setStep(2);
    Alert.alert('Quét thành công', 'Đã nhận diện thông tin tài khoản đích từ mã QR!');
  };

  const handleTransfer = () => {
    if (!amount || parseInt(amount, 10) <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ.');
      return;
    }
    setStep(3);
  };

  const openBankApp = () => {
    Alert.alert(
      'Mở App Ngân hàng',
      `Đang mở ứng dụng ${accountInfo.bank} với số tiền ${parseInt(amount, 10).toLocaleString('vi-VN')} đ và nội dung: "${note}". Vui lòng xác thực vân tay/mã PIN trên app để hoàn tất chuyển tiền.`,
      [{ text: 'Đồng ý' }]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Chuyển khoản QR"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* 3 Bước thực hiện */}
      <View style={[styles.stepsRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, { backgroundColor: step >= 1 ? colors.primary : '#3A3A42' }]}>
            <Text style={[styles.stepNum, { color: step >= 1 ? '#121214' : '#fff' }]}>1</Text>
          </View>
          <Text style={[styles.stepLabel, { color: step === 1 ? colors.primary : colors.sub }]}>Quét QR</Text>
        </View>

        <View style={[styles.stepLine, { backgroundColor: step >= 2 ? colors.primary : '#3A3A42' }]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, { backgroundColor: step >= 2 ? colors.primary : '#3A3A42' }]}>
            <Text style={[styles.stepNum, { color: step >= 2 ? '#121214' : '#fff' }]}>2</Text>
          </View>
          <Text style={[styles.stepLabel, { color: step === 2 ? colors.primary : colors.sub }]}>Nhập tiền & note</Text>
        </View>

        <View style={[styles.stepLine, { backgroundColor: step >= 3 ? colors.primary : '#3A3A42' }]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, { backgroundColor: step >= 3 ? colors.primary : '#3A3A42' }]}>
            <Text style={[styles.stepNum, { color: step >= 3 ? '#121214' : '#fff' }]}>3</Text>
          </View>
          <Text style={[styles.stepLabel, { color: step === 3 ? colors.primary : colors.sub }]}>Chuyển khoản</Text>
        </View>
      </View>

      {/* Bước 1: Quét mã QR */}
      {step === 1 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.scannerBox}>
            <Ionicons name="qr-code" size={100} color={colors.primary} />
            <Text style={styles.scanHint}>Đưa camera vào mã QR ngân hàng hoặc chọn ảnh từ máy</Text>
          </View>

          <Pressable
            onPress={handleScanQr}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="scan" size={20} color="#121214" />
            <Text style={styles.primaryBtnText}>Quét mã QR ngay</Text>
          </Pressable>
        </View>
      )}

      {/* Bước 2: Nhập số tiền & Lời nhắn */}
      {step === 2 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.accInfoBox}>
            <Text style={[styles.accBank, { color: colors.primary }]}>{accountInfo.bank}</Text>
            <Text style={styles.accName}>{accountInfo.name}</Text>
            <Text style={[styles.accNum, { color: colors.sub }]}>STK: {accountInfo.accNum}</Text>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.sub }]}>Số tiền chuyển (VNĐ):</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            style={[styles.inputField, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
          />

          <Text style={[styles.fieldLabel, { color: colors.sub }]}>Lời nhắn / Ghi chú (Note):</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Nội dung chuyển tiền..."
            placeholderTextColor={colors.sub}
            style={[styles.inputField, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
          />

          <Pressable
            onPress={handleTransfer}
            style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
          >
            <Ionicons name="arrow-forward" size={20} color="#121214" />
            <Text style={styles.primaryBtnText}>Xác nhận & Chuyển ngân hàng</Text>
          </Pressable>
        </View>
      )}

      {/* Bước 3: Hoàn tất chuyển qua app ngân hàng */}
      {step === 3 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={60} color="#10B981" />
          </View>

          <Text style={styles.successTitle}>Sẵn sàng hoàn tất giao dịch</Text>
          <Text style={[styles.successSubtitle, { color: colors.sub }]}>
            Thông tin đã được mã hóa theo chuẩn VietQR. Bấm nút dưới để mở ứng dụng ngân hàng và hoàn thành.
          </Text>

          <View style={[styles.summaryBox, { backgroundColor: colors.bg }]}>
            <Text style={[styles.sumRow, { color: colors.text }]}>Người nhận: <Text style={{ fontWeight: '800' }}>{accountInfo.name}</Text></Text>
            <Text style={[styles.sumRow, { color: colors.text }]}>Số tiền: <Text style={{ fontWeight: '800', color: colors.primary }}>{parseInt(amount, 10).toLocaleString('vi-VN')} đ</Text></Text>
            <Text style={[styles.sumRow, { color: colors.text }]}>Ghi chú: <Text style={{ fontWeight: '700' }}>{note}</Text></Text>
          </View>

          <Pressable
            onPress={openBankApp}
            style={[styles.primaryBtn, { backgroundColor: colors.primary, marginBottom: 10 }]}
          >
            <Ionicons name="open-outline" size={20} color="#121214" />
            <Text style={styles.primaryBtnText}>Mở App Ngân Hàng Hoàn Thành</Text>
          </Pressable>

          <Pressable
            onPress={() => setStep(1)}
            style={[styles.cancelBtn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.sub, fontWeight: '700' }}>Quét mã khác</Text>
          </Pressable>
        </View>
      )}
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
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepNum: {
    fontSize: 13,
    fontWeight: '800',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    marginBottom: 16,
  },
  card: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scannerBox: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  scanHint: {
    marginTop: 16,
    textAlign: 'center',
    color: '#9E9EA7',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  accInfoBox: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 208, 0, 0.08)',
    marginBottom: 16,
  },
  accBank: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  accName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  accNum: {
    fontSize: 13,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 999,
    gap: 8,
    marginTop: 20,
    overflow: 'hidden',
  },
  primaryBtnText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#121214',
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 18,
  },
  summaryBox: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    gap: 8,
  },
  sumRow: {
    fontSize: 14,
  },
  cancelBtn: {
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
  },
});
