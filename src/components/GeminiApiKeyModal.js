// src/components/GeminiApiKeyModal.js
// Modal cho phép người dùng nhập và lưu trữ Gemini API Key cá nhân miễn phí
// Kết nối trực tiếp với Google Gemini AI Cloud thật

import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet, Alert, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { getGeminiApiKey, saveGeminiApiKey } from '../services/geminiService';
import { useTheme } from '../theme';

export default function GeminiApiKeyModal({ visible, onClose, onKeySaved }) {
  const { colors } = useTheme();
  const [keyInput, setKeyInput] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);

  useEffect(() => {
    if (visible) {
      let isMounted = true;
      (async () => {
        const k = await getGeminiApiKey();
        if (isMounted) {
          setKeyInput(k || '');
          setHasExistingKey(Boolean(k));
        }
      })();
      return () => {
        isMounted = false;
      };
    }
  }, [visible]);

  const handleSave = async () => {
    const cleaned = keyInput.trim();
    if (!cleaned) {
      Alert.alert('Chưa nhập Key', 'Vui lòng dán mã API Key hoặc bấm Xóa Key nếu muốn dùng chế độ ngoại tuyến.');
      return;
    }
    await saveGeminiApiKey(cleaned);
    setHasExistingKey(true);
    Alert.alert('Kích hoạt thành công! 🎉', 'Đã lưu Gemini API Key. Toàn bộ tính năng AI giờ đây sẽ gọi trực tiếp đến mô hình Gemini 1.5 Flash thật của Google!');
    if (onKeySaved) onKeySaved(cleaned);
    onClose();
  };

  const handleRemove = async () => {
    await saveGeminiApiKey('');
    setKeyInput('');
    setHasExistingKey(false);
    Alert.alert('Đã xóa Key', 'Ứng dụng đã chuyển về chế độ ngoại tuyến (Local Fallback).');
    if (onKeySaved) onKeySaved('');
    onClose();
  };

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setKeyInput(text.trim());
    } catch {
      // ignore
    }
  };

  const handleOpenGoogleAiStudio = () => {
    Linking.openURL('https://aistudio.google.com/app/apikey').catch(() => {
      Alert.alert('Địa chỉ website', 'Bạn hãy mở trình duyệt và truy cập: https://aistudio.google.com để lấy Key miễn phí nhé!');
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="key" size={20} color="#7C3AED" />
              <Text style={[styles.title, { color: colors.text }]}>Cài đặt Gemini API Key</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.sub} />
            </Pressable>
          </View>

          <Text style={[styles.desc, { color: colors.sub }]}>
            Để gọi trực tiếp mô hình Google Gemini AI thật trên đám mây, bạn chỉ cần lấy 1 mã API Key miễn phí (Free Tier vĩnh viễn, không cần thẻ ngân hàng) từ Google AI Studio.
          </Text>

          <Pressable onPress={handleOpenGoogleAiStudio} style={styles.linkRow}>
            <Ionicons name="open-outline" size={16} color="#7C3AED" />
            <Text style={styles.linkText}>Nhấn vào đây để lấy Key miễn phí (Google AI Studio)</Text>
          </Pressable>

          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder="Dán mã API Key của bạn vào đây"
              placeholderTextColor={colors.sub}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {keyInput.length === 0 && (
              <Pressable onPress={handlePaste} style={styles.pasteBtn}>
                <Text style={styles.pasteBtnText}>Dán</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: hasExistingKey ? '#10B981' : '#F59E0B' }]} />
            <Text style={[styles.statusText, { color: colors.sub }]}>
              {hasExistingKey
                ? 'Đã kết nối: Mô hình Gemini 1.5 Flash (Cloud AI thật)'
                : 'Chưa có Key: Đang chạy chế độ ngoại tuyến (Local Fallback)'}
            </Text>
          </View>

          <View style={styles.actions}>
            {hasExistingKey && (
              <Pressable onPress={handleRemove} style={[styles.btn, styles.btnDanger]}>
                <Text style={styles.btnDangerText}>Xóa Key</Text>
              </Pressable>
            )}
            <Pressable onPress={handleSave} style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnPrimaryText}>Lưu & Kích hoạt</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', padding: 20,
  },
  card: {
    borderRadius: 20, padding: 20, borderWidth: 1,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '800' },
  desc: { fontSize: 13, lineHeight: 18, marginBottom: 12, fontWeight: '500' },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.1)', marginBottom: 14,
  },
  linkText: { fontSize: 12, color: '#7C3AED', fontWeight: '700' },
  inputWrapper: { position: 'relative', marginBottom: 12 },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 13, paddingRight: 60,
  },
  pasteBtn: {
    position: 'absolute', right: 12, top: 12,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
  },
  pasteBtnText: { color: '#7C3AED', fontSize: 12, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '600', flex: 1 },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#7C3AED', flex: 1 },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  btnDanger: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: '#EF4444' },
  btnDangerText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },
});

