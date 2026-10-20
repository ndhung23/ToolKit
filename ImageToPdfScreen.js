import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const MAX_WIDTH = 1600; // thu nhỏ ảnh để PDF không quá nặng

export default function ImageToPdfScreen({ onBack }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Chọn nhiều ảnh từ thư viện
  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 0, // 0 = không giới hạn
      quality: 1,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets]);
    }
  };

  const removeImage = (index) =>
    setImages((prev) => prev.filter((_, i) => i !== index));

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
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
        pages.push(
          `<div class="page"><img src="data:image/jpeg;base64,${out.base64}" /></div>`
        );
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

      // Kích thước A4 theo point: 595 x 842
      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });

      // 3. Mở bảng chia sẻ của iOS: chọn "Lưu vào Tệp" để lưu PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Đã tạo PDF', uri);
      }
    } catch (e) {
      Alert.alert('Lỗi', String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.row}>
      <Image source={{ uri: item.uri }} style={styles.thumb} />
      <Text style={styles.pageNo}>Trang {index + 1}</Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => move(index, -1)} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>↑</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => move(index, 1)} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>↓</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => removeImage(index)} style={styles.smallBtn}>
          <Text style={[styles.smallBtnText, { color: '#d00' }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Ảnh → PDF</Text>
        <View style={{ width: 70 }} />
      </View>

      <FlatList
        data={images}
        keyExtractor={(item, i) => item.uri + i}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>Chưa có ảnh nào. Bấm "Chọn ảnh" để bắt đầu.</Text>
        }
        contentContainerStyle={{ padding: 16 }}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnSecondary} onPress={pickImages} disabled={loading}>
          <Text style={styles.btnSecondaryText}>+ Chọn ảnh</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={createPdf} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnPrimaryText}>Tạo PDF ({images.length})</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff',
  },
  back: { fontSize: 16, color: '#007aff', width: 70 },
  title: { fontSize: 18, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 10, marginBottom: 10,
  },
  thumb: { width: 60, height: 80, borderRadius: 6, backgroundColor: '#eee' },
  pageNo: { flex: 1, marginLeft: 12, fontSize: 15 },
  actions: { flexDirection: 'row' },
  smallBtn: { padding: 10 },
  smallBtnText: { fontSize: 18 },
  footer: {
    flexDirection: 'row', padding: 16, paddingBottom: 32, backgroundColor: '#fff', gap: 12,
  },
  btnSecondary: {
    flex: 1, borderWidth: 1, borderColor: '#007aff', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnSecondaryText: { color: '#007aff', fontSize: 16, fontWeight: '600' },
  btnPrimary: {
    flex: 1, backgroundColor: '#007aff', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
