import { useState } from 'react';
import { View } from 'react-native';
import AiFloatingBotButton from './AiFloatingBotButton';
import AiChatBottomSheet from './AiChatBottomSheet';

export default function AiFloatingBot() {
  const [chatVisible, setChatVisible] = useState(false);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
      {/* Nút con bot nổi có thể kéo di chuyển */}
      <AiFloatingBotButton onPress={() => setChatVisible(true)} />

      {/* Khung chat Bottom Sheet */}
      <AiChatBottomSheet
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
      />
    </View>
  );
}

export { AiFloatingBotButton, AiChatBottomSheet };
