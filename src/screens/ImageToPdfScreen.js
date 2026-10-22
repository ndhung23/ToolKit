import { useMemo, useState } from 'react';
import {
  View, Text, FlatList, Image, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, useTheme } from '../theme';

const MAX_WIDTH = 1600; // thu nhỏ ảnh để PDF không quá nặng

export default function ImageToPdfScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Chọn nhiều ảnh từ thư viện
  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 1,
    });
    if (!result.canceled) setImages((prev) => [...prev, ...result.assets]);
  };

  const removeImage = (i) => setImages((prev) => prev.filter((_, idx) => idx !== i));

  const move = (i, delta) => {
    const t = i + delta;
    if (t < 0 || t >= images.length) return;
    const next = [...images];
    [next[i], next[t]] = [next[t], next[i]];
    setImages(next);
  };

  // 2. Tạo PDF: mỗi ảnh một trang A4
  const createPdf = async () => {
    if (images.length === 0) {
      Alert.alert('Chưa có ảnh', 'Hãy chọn ít nhất 1 ảnh.');
      return;
    }
    setLoading(true);
    try {
      const pages = [];
      for (const img of images) {
        const actions = img.width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [];
        const out = await ImageManipulator.manipulateAsync(img.uri, actions, {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        });
        pages.push(`<div class="page"><img src="data:image/jpeg;base64,${out.base64}" /></div>`);
      }

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              @page { margin: 0; }
              body { margin: 0; padding: 0; }
              .page {
                width: 595px; height: 842px;
                display: flex; align-items: center; justify-content: center;
                page-break-after: always;
              }
              img { max-width: 100%; max-height: 100%; object-fit: contain; }
            </style>
          </head>
          <body>${pages.join('')}</body>
        </html>`;

      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });

      // 3. Mở bảng chia sẻ iOS → chọn "Lưu vào Tệp"
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Đã tạo PDF', uri);
      }
    } catch (e) {
      Alert.alert('Lỗi', String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const iconBtn = { padding: 8 };

  const renderItem = ({ item, index }) => (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
        borderRadius: radius.lg, padding: 10, marginBottom: 10,
        borderWidth: 1, borderColor: colors.border,
      }}
    >
      <Image source={{ uri: item.uri }} style={{ width: 56, height: 72, borderRadius: 8, backgroundColor: colors.border }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Trang {index + 1}</Text>
      </View>
      <Pressable onPress={() => move(index, -1)} style={iconBtn} hitSlop={6}>
        <Ionicons name="arrow-up" size={20} color={colors.sub} />
      </Pressable>
      <Pressable onPress={() => move(index, 1)} style={iconBtn} hitSlop={6}>
        <Ionicons name="arrow-down" size={20} color={colors.sub} />
      </Pressable>
      <Pressable onPress={() => removeImage(index)} style={iconBtn} hitSlop={6}>
        <Ionicons name="close-circle" size={22} color={colors.danger} />
      </Pressable>
    </View>
  );

  const empty = useMemo(
    () => (
      <View style={{ alignItems: 'center', marginTop: 60 }}>
        <View
          style={{
            width: 88, height: 88, borderRadius: 26, backgroundColor: colors.primary + '1A',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}
        >
          <Ionicons name="images-outline" size={42} color={colors.primary} />
        </View>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Chưa có ảnh nào</Text>
        <Text style={{ color: colors.sub, marginTop: 6 }}>Bấm "Chọn ảnh" để bắt đầu</Text>
      </View>
    ),
    [colors]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={images}
        keyExtractor={(item, i) => item.uri + i}
        renderItem={renderItem}
        ListEmptyComponent={empty}
        contentContainerStyle={{ padding: 16 }}
      />
      <View
        style={{
          flexDirection: 'row', gap: 12, padding: 16, paddingBottom: Math.max(insets.bottom, 16),
          backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
        }}
      >
        <Pressable
          onPress={pickImages}
          disabled={loading}
          style={{
            flex: 1, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md,
            paddingVertical: 14, alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>+ Chọn ảnh</Text>
        </Pressable>
        <Pressable
          onPress={createPdf}
          disabled={loading}
          style={{
            flex: 1, backgroundColor: colors.primary, borderRadius: radius.md,
            paddingVertical: 14, alignItems: 'center', opacity: loading ? 0.8 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#121214" />
          ) : (
            <Text style={{ color: '#121214', fontWeight: '800', fontSize: 16 }}>Tạo PDF ({images.length})</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
