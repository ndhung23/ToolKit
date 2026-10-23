This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md


REACT NATIVE AI CODING GUIDELINES
Mandatory Rules for iOS & Android
Mục đích: Đây là tài liệu quy định bắt buộc cho mọi AI Agent khi tạo mới, sửa đổi, refactor hoặc review code trong dự án React Native sử dụng JavaScript.
Nguyên tắc tối cao: Không được tự ý bỏ qua quy tắc. Không được sửa một lỗi bằng cách tạo ra lỗi khác. Không được tuyên bố hoàn thành nếu chưa kiểm tra các tiêu chí nghiệm thu tương ứng.

1. TECH STACK BẮT BUỘC
Framework: React Native.
Ngôn ngữ: JavaScript.
UI: React Native components.
Hỗ trợ đầy đủ cả iOS và Android.
Không chuyển sang TypeScript nếu người dùng chưa cho phép.
Không tự ý thay đổi framework, kiến trúc, thư viện hoặc cấu trúc dự án hiện có.
Ưu tiên sử dụng các thư viện đã có trong dự án.
Trước khi code, phải kiểm tra package.json, cấu trúc thư mục, phiên bản React Native và các thư viện hiện có.
Không tự ý cài thêm package nếu tính năng có thể giải quyết an toàn bằng công cụ hiện có.
Không sử dụng API đã deprecated nếu có phương án được hỗ trợ phù hợp với phiên bản dự án.
Quy trình làm việc bắt buộc
Đọc và hiểu code hiện tại.
Xác định các màn hình, component, navigation và luồng dữ liệu liên quan.
Xác định nguyên nhân hoặc yêu cầu thực sự trước khi sửa.
Lập phương án thay đổi tối thiểu nhưng đầy đủ.
Viết code theo các quy tắc trong tài liệu này.
Kiểm tra lỗi cú pháp, import, dependency và luồng xử lý.
Chạy các kiểm tra có thể thực hiện.
Báo cáo rõ phần đã làm, phần đã kiểm tra và phần chưa thể xác minh.
Không được viết lại toàn bộ dự án chỉ để sửa một component nhỏ, trừ khi người dùng yêu cầu.

2. SAFE AREA — KHÔNG ĐỂ UI DÍNH TAI THỎ
Mọi màn hình phải xử lý chính xác vùng an toàn trên iOS và Android, bao gồm:
Tai thỏ, Dynamic Island và camera đục lỗ.
Thanh trạng thái (Status Bar).
Thanh điều hướng hệ thống ở cạnh dưới.
Thanh gesture và vùng home indicator.
Các cạnh màn hình có inset đặc biệt.
Quy tắc bắt buộc
Sử dụng react-native-safe-area-context nếu dự án đã có hoặc sau khi được phép bổ sung dependency.
Ưu tiên SafeAreaProvider ở cấp ứng dụng và SafeAreaView hoặc useSafeAreaInsets() tại màn hình phù hợp.
Không cộng padding cố định một cách tùy tiện, ví dụ paddingTop: 50, để né tai thỏ.
Không giả định chiều cao Status Bar giống nhau trên mọi thiết bị.
Không áp dụng Safe Area hai lần gây dư khoảng trắng.
Phải kiểm tra sự kết hợp giữa Safe Area, Status Bar, navigation header, modal và keyboard.
Không đặt nút bấm hoặc nội dung quan trọng dưới thanh điều hướng hệ thống.
Không sử dụng các API Safe Area cũ đã bị loại bỏ khi phiên bản thư viện hiện tại có API thay thế.
Ví dụ cấu trúc ứng dụng:
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
Ví dụ màn hình:
import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Text>Home Screen</Text>
      </View>
    </SafeAreaView>
  );
}
Đây là ví dụ tối thiểu. Khi áp dụng vào dự án thật, phải kiểm tra cấu hình navigation, vùng safe area và thanh trạng thái để tránh inset bị tính trùng.

3. INPUT — TUYỆT ĐỐI KHÔNG ĐƯỢC MẤT FOCUS
Đây là quy tắc có mức ưu tiên rất cao vì lỗi input có thể khiến ứng dụng không thể sử dụng được.
Yêu cầu: Khi người dùng nhấn vào TextInput, bàn phím điện thoại phải hiện ra, người dùng nhập được liên tục và input không tự mất focus khi component render lại.
3.1. Những lỗi bị nghiêm cấm
AI không được:
Khai báo component con có chứa TextInput bên trong component cha ở mỗi lần render nếu việc đó khiến component bị tạo lại và mất trạng thái.
Đặt key thay đổi theo từng ký tự nhập.
Thay đổi key của form hoặc input sau mỗi lần cập nhật state.
Gọi navigation.navigate(), navigation.replace() hoặc đóng modal ngoài ý muốn khi nhập.
Gọi Keyboard.dismiss() trong mỗi lần render hoặc mỗi lần onChangeText.
Dùng autoFocus cho tất cả input một cách tùy tiện.
Gọi setState trong vòng lặp render.
Reset giá trị input khi component render lại.
Thay đổi cấu trúc component không cần thiết mỗi lần nhập.
Dùng editable={false} hoặc pointerEvents="none" khiến người dùng không thể nhập.
Để một lớp View trong suốt hoặc overlay chặn thao tác chạm.
Đặt TextInput bên trong vùng cuộn ngang/dọc lồng nhau mà không xử lý gesture hợp lý.
Sử dụng logic format dữ liệu khiến con trỏ nhảy liên tục hoặc ký tự vừa nhập bị xóa.
Dùng value có kiểu không phù hợp hoặc cập nhật state không đúng.
Thực hiện request API, điều hướng hoặc reset toàn bộ form trong mỗi lần nhập ký tự.
3.2. Cách khai báo TextInput đúng
import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
} from 'react-native';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable
        returnKeyType="next"
        accessibilityLabel="Email"
      />

      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Mật khẩu"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable
        returnKeyType="done"
        accessibilityLabel="Mật khẩu"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
});
3.3. Quy tắc component và state
Khai báo component ở cấp module, bên ngoài component cha.
Chỉ cập nhật state cần thiết, không reset toàn bộ màn hình khi người dùng nhập.
Không dùng index thay đổi hoặc giá trị nhập hiện tại làm key của input.
Nếu dùng React Hook Form hoặc thư viện quản lý form, phải tuân thủ đúng cách tích hợp Controller, value và onChangeText.
Không trộn nhiều nguồn dữ liệu cùng kiểm soát một input.
Chỉ format giá trị khi thật sự cần thiết và phải giữ vị trí con trỏ hợp lý.
Không sử dụng useEffect để liên tục ghi đè giá trị đang nhập nếu không có lý do rõ ràng.
3.4. Bàn phím và xử lý thao tác
Dùng keyboardType phù hợp: email-address, numeric, phone-pad, decimal-pad hoặc default.
Dùng secureTextEntry cho mật khẩu.
Dùng returnKeyType và onSubmitEditing phù hợp với luồng nhập.
Khi cần ẩn bàn phím, chỉ thực hiện tại các hành động hợp lý như gửi form hoặc nhấn nút đóng.
Không bắt buộc người dùng đóng bàn phím rồi mới được tiếp tục nhập trường tiếp theo.
Xử lý keyboard khi mở modal, điều hướng hoặc khi màn hình bị che.
Với form dài, dùng KeyboardAvoidingView khi phù hợp; không để bàn phím che input đang nhập.
Trên Android, kiểm tra windowSoftInputMode, đặc biệt khi sử dụng modal hoặc navigation.
Không tự ý thay đổi cấu hình bàn phím toàn ứng dụng nếu chỉ một màn hình cần điều chỉnh.
Ví dụ dùng KeyboardAvoidingView:
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';

export default function FormScreen() {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={{ flex: 1, padding: 16 }}>
        {/* Form components */}
      </View>
    </KeyboardAvoidingView>
  );
}
Không sao chép keyboardVerticalOffset={0} một cách máy móc. Phải xác định header, safe area và cách bố trí thực tế để chọn offset đúng.

4. CẤM SỬ DỤNG ScrollView
Quy tắc: Không sử dụng ScrollView trong code mới và không thay thế nó bằng một cơ chế cuộn thủ công.
Các API bị cấm bao gồm:
ScrollView
Animated.ScrollView
Các wrapper tự tạo chỉ nhằm che giấu việc sử dụng ScrollView
Thành phần thay thế
FlatList: danh sách dữ liệu cùng loại.
SectionList: danh sách được chia theo nhóm hoặc section.
View: bố cục tĩnh không cần cuộn.
Modal hoặc giải pháp chuyên biệt khi phù hợp với chức năng thực tế.
Ví dụ FlatList:
import React from 'react';
import { FlatList, Text, View } from 'react-native';

const DATA = [
  { id: '1', title: 'Sản phẩm 1' },
  { id: '2', title: 'Sản phẩm 2' },
  { id: '3', title: 'Sản phẩm 3' },
];

export default function ProductList() {
  return (
    <FlatList
      data={DATA}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={{ padding: 16 }}>
          <Text>{item.title}</Text>
        </View>
      )}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={10}
    />
  );
}
Quy tắc sử dụng FlatList và SectionList
Luôn cung cấp keyExtractor ổn định.
Không dùng index làm key nếu danh sách có thể thêm, xóa hoặc sắp xếp lại.
Không lồng các danh sách cuộn cùng hướng nếu không có lý do kiến trúc rõ ràng.
Không đặt FlatList bên trong FlatList chỉ để tạo hiệu ứng cuộn.
Không dùng FlatList để thay thế một bố cục tĩnh không cần cuộn.
Với header/footer của màn hình danh sách, ưu tiên ListHeaderComponent và ListFooterComponent.
Với danh sách có nhóm, sử dụng SectionList.
Chỉ dùng extraData khi danh sách cần render lại dựa trên state bên ngoài data.
Không sử dụng removeClippedSubviews một cách tùy tiện vì có thể gây vấn đề hiển thị trên một số cấu hình.
Quy tắc FlatList kết hợp TextInput
Đối với màn hình form hoặc danh sách có input:
Dùng keyboardShouldPersistTaps="handled" hoặc "always" tùy hành vi mong muốn.
Không được để thao tác chạm vào input bị mất vì danh sách tự xử lý thao tác chạm.
Đảm bảo component input không bị unmount ngoài ý muốn.
Không đặt key thay đổi theo giá trị nhập.
Phải kiểm tra thao tác nhập liên tục khi bàn phím đang mở.
Lưu ý: keyboardShouldPersistTaps không tự sửa được mọi lỗi focus. AI phải tìm đúng nguyên nhân nếu input vẫn mất focus.

5. BẢO MẬT — .ENV, API KEY VÀ SECRETS
Không được hard-code thông tin nhạy cảm trong bất kỳ file source code nào.
Các thông tin cần bảo vệ bao gồm:
API keys.
Client secrets.
Private keys và signing keys.
Database passwords.
Access tokens và refresh tokens.
Service account credentials.
Secret keys của dịch vụ thanh toán.
Thông tin xác thực của hệ thống nội bộ.
Thông tin nhạy cảm trong file cấu hình, log hoặc test fixture.
5.1. Những hành vi bị cấm
Không được:
Ghi API key thật trực tiếp trong .js, .jsx, .json hoặc file cấu hình được commit.
Đưa secrets vào Git.
Ghi token hoặc mật khẩu vào log.
Đưa secrets vào URL hoặc thông báo lỗi hiển thị cho người dùng.
Đưa file .env thật vào bản build hoặc repository công khai.
Giả định rằng biến process.env trong ứng dụng React Native tự động an toàn hoặc tự động được hỗ trợ.
Đưa private key hoặc server secret vào ứng dụng mobile với lý do đã dùng .env.
Dùng Base64, mã hóa chuỗi hoặc đổi tên biến như một phương pháp bảo mật secrets.
5.2. Quy tắc dùng .env
Chỉ dùng thư viện quản lý biến môi trường phù hợp với hệ thống build và phiên bản dự án.
Thêm file .env chứa secrets vào .gitignore.
Tạo .env.example chỉ chứa tên biến và giá trị giả.
Kiểm tra .gitignore trước khi tạo hoặc cập nhật cấu hình.
Không in giá trị thật của biến môi trường ra log.
Không tự ý đổi tên hoặc xóa biến môi trường đang được các module sử dụng.
Ví dụ .env.example:
API_BASE_URL=https://api.example.com
PUBLIC_ANALYTICS_ID=replace_with_placeholder
Ví dụ sử dụng biến cấu hình:
import Config from 'react-native-config';

export const API_BASE_URL = Config.API_BASE_URL;
Đoạn code trên chỉ phù hợp khi dự án đã cấu hình react-native-config. AI phải kiểm tra dependency và cấu hình native trước khi áp dụng.
Cảnh báo bảo mật: Biến môi trường được đóng gói vào ứng dụng mobile có thể bị trích xuất. API URL và một số public identifier có thể được đưa vào ứng dụng, nhưng private key, server secret và thông tin xác thực đặc quyền phải được lưu ở backend hoặc hệ thống quản lý secrets an toàn.
5.3. Khi cần API key
Nếu API yêu cầu secret không thể công khai:
Không đưa secret vào ứng dụng React Native.
Xây dựng hoặc sử dụng backend để thực hiện thao tác cần secret.
Ứng dụng gọi backend qua HTTPS.
Backend xác thực và phân quyền request.
Không để lộ token hoặc secret trong response, log hay thông báo lỗi.
Không được coi .env là biện pháp bảo vệ tuyệt đối cho dữ liệu được đóng gói vào ứng dụng mobile.

6. TƯƠNG THÍCH iOS VÀ ANDROID
Mọi chức năng phải được thiết kế để hoạt động trên cả hai nền tảng, trừ khi người dùng yêu cầu rõ ràng chỉ hỗ trợ một nền tảng.
Quy tắc bắt buộc
Dùng Platform.OS khi thực sự cần logic riêng cho nền tảng.
Kiểm tra permission và cấu hình native của từng nền tảng.
Kiểm tra Status Bar, Safe Area, keyboard và navigation trên iOS lẫn Android.
Không giả định hành vi gesture, modal hoặc keyboard giống nhau giữa hai hệ điều hành.
Không chỉ dựa vào simulator của một nền tảng để tuyên bố tương thích cả hai.
Kiểm tra font, kích thước, vùng chạm và nội dung khi thay đổi kích thước màn hình.
Xử lý các trạng thái loading, empty, error và permission denied.
Không sử dụng API chỉ có trên một nền tảng mà không có phương án thay thế hợp lý.
Ví dụ:
import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
Chỉ dùng điều kiện nền tảng khi cần thiết. Không tạo hai phiên bản code riêng biệt nếu một cách triển khai chung có thể hoạt động ổn định.

7. KIẾN TRÚC VÀ CHẤT LƯỢNG CODE
Mỗi component có trách nhiệm rõ ràng.
Tách UI, business logic, API services và cấu hình khi phù hợp.
Không tạo component quá lớn nếu có thể tách mà không làm phức tạp dự án.
Không lặp lại logic xử lý ở nhiều nơi nếu có thể tái sử dụng an toàn.
Không tạo abstraction không cần thiết chỉ để code trông phức tạp hơn.
Không sử dụng biến toàn cục để quản lý state của form.
Không gọi API trực tiếp trong phần render.
Không bỏ qua xử lý lỗi của Promise.
Không để request cũ ghi đè dữ liệu mới khi người dùng thay đổi bộ lọc hoặc điều hướng nhanh.
Cleanup subscription, listener và timer khi component unmount.
Không tắt ESLint hoặc bỏ qua warning chỉ để làm cho build có vẻ sạch.
Không xóa test để làm cho CI vượt qua.
Không thay đổi behavior hiện tại ngoài phạm vi yêu cầu mà không thông báo.
Quy tắc API
Tách API service khỏi component khi phù hợp.
Dùng HTTPS cho API production.
Có xử lý timeout, lỗi mạng và lỗi xác thực.
Không gửi mật khẩu hoặc token vào log.
Không tự động retry các thao tác ghi dữ liệu nếu có nguy cơ tạo giao dịch trùng lặp.
Không giả lập kết quả thành công khi request thực tế thất bại.
Không hard-code dữ liệu giả để che giấu lỗi API trong production.

8. NAVIGATION, MODAL VÀ VÒNG ĐỜI COMPONENT
Các lỗi điều hướng và vòng đời component có thể khiến input mất focus hoặc mất dữ liệu.
AI phải tuân thủ:
Không reset navigation stack ngoài yêu cầu.
Không remount toàn bộ màn hình khi state thay đổi.
Không tạo lại component navigation ở mỗi lần render.
Không tự ý đóng modal khi bàn phím xuất hiện.
Không điều hướng trong renderItem hoặc trong quá trình render.
Không đặt side effect trong phần render.
Không xóa dữ liệu form khi quay lại màn hình nếu người dùng không yêu cầu.
Xử lý trạng thái loading và double-tap để tránh gửi form nhiều lần.
Hủy hoặc bỏ qua kết quả request không còn phù hợp với màn hình hiện tại.
Khi sửa lỗi focus, phải xác định component nào bị unmount hoặc đổi identity thay vì thêm workaround tùy tiện.

9. HIỆU NĂNG VÀ TRẢI NGHIỆM NGƯỜI DÙNG
Tránh render lại danh sách lớn không cần thiết.
Dùng FlatList hoặc SectionList cho dữ liệu danh sách cần cuộn.
Dùng key ổn định.
Không tạo object hoặc callback mới một cách máy móc trong mọi nơi rồi thêm memoization tràn lan.
Chỉ dùng React.memo, useMemo và useCallback khi có lợi ích thực tế.
Không chặn luồng JavaScript bằng tác vụ nặng trong lúc nhập liệu.
Không chạy tác vụ đồng bộ tốn thời gian trong onChangeText.
Không gọi API mỗi ký tự nếu yêu cầu không cần thiết; nếu cần tìm kiếm trực tiếp, áp dụng debounce phù hợp và tránh response cũ ghi đè response mới.
Hiển thị trạng thái loading khi thao tác cần thời gian.
Có phản hồi lỗi rõ ràng và cho phép thử lại khi phù hợp.
Không để nút bấm quan trọng bị bàn phím che khuất mà không có phương án thao tác.

10. CHECKLIST KIỂM TRA TRƯỚC KHI HOÀN THÀNH
AI phải kiểm tra checklist này sau mỗi thay đổi có liên quan.
UI và Safe Area
Không có nội dung quan trọng nằm dưới tai thỏ hoặc Dynamic Island.
Không có nội dung bị che bởi Status Bar.
Không có nút quan trọng bị che bởi thanh điều hướng dưới.
Không có padding Safe Area bị cộng hai lần.
Modal và navigation không gây lệch layout.
Input và bàn phím
Nhấn input sẽ mở bàn phím theo đúng loại dữ liệu.
Nhập liên tục nhiều ký tự không bị mất focus.
Không bị mất hoặc reset dữ liệu khi render lại.
Không bị mất ký tự do xử lý state sai.
Con trỏ không nhảy bất thường khi nhập thông thường.
Có thể chuyển giữa các trường theo luồng mong muốn.
Bàn phím không che input đang nhập hoặc nút thao tác cần thiết.
Tương tác với danh sách khi bàn phím đang mở hoạt động đúng.
Gửi form không tạo nhiều request do double-tap.
Danh sách và cuộn
Không có ScrollView mới.
Không có Animated.ScrollView mới.
Danh sách sử dụng FlatList hoặc SectionList khi cần cuộn.
Key của item ổn định.
Không có lỗi nested scrolling không cần thiết.
Input bên trong danh sách vẫn nhận focus và nhập được.
Bảo mật
Không có API key hoặc secret hard-code.
Không commit file .env thật.
Không ghi token hoặc password vào log.
Không đóng gói private key hoặc server secret vào ứng dụng.
Biến môi trường được đọc theo cấu hình thực tế của dự án.
Không vô tình đưa dữ liệu nhạy cảm vào file test hoặc ví dụ.
Tương thích nền tảng
Kiểm tra iOS.
Kiểm tra Android.
Kiểm tra keyboard và Safe Area trên cả hai nền tảng.
Kiểm tra permission và hành vi riêng của nền tảng khi có liên quan.
Không có lỗi import, dependency hoặc cấu hình native phát sinh từ thay đổi.
Chất lượng code
Không có lỗi cú pháp.
Không có import không tồn tại.
Không có side effect trong render.
Không có lỗi nghiêm trọng trong console.
Đã chạy các kiểm tra phù hợp với môi trường có sẵn.
Đã nêu rõ những kiểm tra chưa thể thực hiện.

11. QUY TRÌNH DEBUG BẮT BUỘC
Khi có lỗi, AI phải làm theo thứ tự:
Tái hiện hoặc xác định chính xác tình huống gây lỗi.
Kiểm tra component tree và vòng đời component.
Kiểm tra state, props, key và điều hướng.
Kiểm tra listener, modal, gesture và keyboard.
Xác định nguyên nhân gốc.
Sửa phần code nhỏ nhất có thể giải quyết nguyên nhân.
Kiểm tra lại luồng hoạt động bình thường và các trường hợp liên quan.
Chạy test hoặc build phù hợp.
Báo cáo nguyên nhân, thay đổi và kết quả xác minh.
Không được sửa lỗi theo kiểu thử nhiều workaround ngẫu nhiên mà không xác định nguyên nhân.
Nếu chưa thể tái hiện lỗi, phải nói rõ điều đó và nêu các giả thuyết cần xác minh. Không được tuyên bố đã sửa triệt để khi chưa có bằng chứng.

12. QUY TẮC KHI AI KHÔNG CHẮC CHẮN
Không tự bịa API hoặc tên package.
Không tự giả định dependency đã được cài.
Không tự thay đổi cấu hình native quan trọng nếu chưa kiểm tra.
Không bỏ qua lỗi build hoặc test có liên quan.
Không tuyên bố đã chạy trên thiết bị thật nếu chỉ phân tích code.
Nếu thiếu thông tin không thiết yếu, hãy chọn giải pháp an toàn, phù hợp với kiến trúc hiện có.
Nếu thiếu thông tin thiết yếu có thể làm thay đổi kiến trúc hoặc bảo mật, hãy hỏi người dùng trước khi thực hiện.
Nếu yêu cầu xung đột với quy tắc này, phải thông báo xung đột và đề xuất giải pháp an toàn hơn.

13. MẪU BÁO CÁO SAU KHI CODE
Sau khi hoàn thành nhiệm vụ, AI phải trả lời theo cấu trúc:
Đã thực hiện
Nêu các file đã tạo hoặc chỉnh sửa.
Nêu chức năng đã hoàn thành.
Nêu các thay đổi liên quan đến Safe Area, input, keyboard, danh sách và bảo mật nếu có.
Kiểm tra
Nêu lệnh test, lint hoặc build đã thực sự chạy.
Nêu kết quả của từng kiểm tra.
Phân biệt rõ kiểm tra bằng phân tích code và kiểm tra trên thiết bị.
Chưa xác minh
Nêu các trường hợp chưa kiểm tra được.
Nêu lỗi còn tồn tại hoặc giới hạn môi trường.
Không được che giấu warning hoặc lỗi chưa giải quyết.
Bảo mật
Xác nhận các thay đổi có liên quan đến secrets đã được kiểm tra.
Không hiển thị giá trị secrets trong báo cáo.

14. LỆNH ƯU TIÊN CAO NHẤT DÀNH CHO AI
Trước khi hoàn tất bất kỳ nhiệm vụ nào, hãy tự kiểm tra:
Code có thực sự chạy trong dự án hiện tại không?
Input có thể được nhấn và nhập liên tục mà không mất focus không?
Bàn phím có hiện đúng trên iOS và Android không?
UI có tránh tai thỏ, Status Bar và thanh điều hướng hệ thống không?
Có sử dụng ScrollView hoặc Animated.ScrollView không?
Có secrets bị hard-code hoặc đưa vào bundle không?
Có làm hỏng navigation, state hoặc chức năng hiện có không?
Có bằng chứng kiểm tra phù hợp cho các thay đổi đã thực hiện không?
Nếu bất kỳ câu trả lời nào chưa đạt, không được tuyên bố nhiệm vụ hoàn thành. Hãy sửa lỗi nếu có thể; nếu không thể xác minh hoặc sửa trong môi trường hiện tại, phải báo cáo trung thực.
Mục tiêu cuối cùng: Code React Native bằng JavaScript ổn định, bảo mật, dễ bảo trì và hoạt động đúng trên cả iOS lẫn Android; đặc biệt không để người dùng mất khả năng nhập liệu, không để UI bị che bởi vùng hệ thống và không đưa secrets vào mã nguồn hoặc ứng dụng phát hành.

