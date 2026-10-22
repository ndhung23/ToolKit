import { View, Text, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ScreenTimeScreen from '../screens/ScreenTimeScreen';
import QrTransferScreen from '../screens/QrTransferScreen';
import ToolsScreen from '../screens/ToolsScreen';
import StatsScreen from '../screens/StatsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ImageToPdfScreen from '../screens/ImageToPdfScreen';
import AutoClickScreen from '../screens/AutoClickScreen';
import FindDeviceScreen from '../screens/FindDeviceScreen';
import CleanPhotosScreen from '../screens/CleanPhotosScreen';
import FbMultiScreen from '../screens/FbMultiScreen';
import AiReplyScreen from '../screens/AiReplyScreen';
import AdminScreen from '../screens/AdminScreen';
import FloatingTabBar from '../components/FloatingTabBar';
import { RoleBadge } from '../components/ui';
import { ROLES } from '../constants/roles';

const FAVICON_ICON = require('../../assets/favicon1.png');

const AuthStackNav = createNativeStackNavigator();
const AppStackNav = createNativeStackNavigator();
const TabNav = createBottomTabNavigator();
const DrawerNav = createDrawerNavigator();

/* ---------- 1. AUTH STACK (Chưa đăng nhập) ---------- */
function AuthStack() {
  return (
    <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
    </AuthStackNav.Navigator>
  );
}

/* ---------- 2. TAB (5 tab nổi) ---------- */
function Tabs() {
  return (
    <TabNav.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <TabNav.Screen name="Home" component={HomeScreen} options={{ title: 'Trang chủ' }} />
      <TabNav.Screen name="ScreenTime" component={ScreenTimeScreen} options={{ title: 'Thời gian dùng' }} />
      <TabNav.Screen name="QrTransfer" component={QrTransferScreen} options={{ title: 'Chuyển khoản QR' }} />
      <TabNav.Screen name="Tools" component={ToolsScreen} options={{ title: 'Tiện ích' }} />
      <TabNav.Screen name="Stats" component={StatsScreen} options={{ title: 'Thống kê' }} />
    </TabNav.Navigator>
  );
}

/* ---------- 3. APP STACK (Tab + 8 tính năng chi tiết) ---------- */
function AppStack() {
  const { colors } = useTheme();
  return (
    <AppStackNav.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '800' },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <AppStackNav.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <AppStackNav.Screen
        name="ImageToPdf"
        component={ImageToPdfScreen}
        options={{ title: 'Chuyển ảnh thành PDF' }}
      />
      <AppStackNav.Screen
        name="AutoClick"
        component={AutoClickScreen}
        options={{ title: 'Auto Click' }}
      />
      <AppStackNav.Screen
        name="QrTransfer"
        component={QrTransferScreen}
        options={{ title: 'Chuyển khoản bằng QR' }}
      />
      <AppStackNav.Screen
        name="ScreenTime"
        component={ScreenTimeScreen}
        options={{ title: 'Thời gian sử dụng' }}
      />
      <AppStackNav.Screen
        name="FindDevice"
        component={FindDeviceScreen}
        options={{ title: 'Tìm vị trí thiết bị' }}
      />
      <AppStackNav.Screen
        name="CleanPhotos"
        component={CleanPhotosScreen}
        options={{ title: 'Dọn ảnh trùng lặp' }}
      />
      <AppStackNav.Screen
        name="FbMulti"
        component={FbMultiScreen}
        options={{ title: 'Quản lý tài khoản Facebook' }}
      />
      <AppStackNav.Screen
        name="AiReply"
        component={AiReplyScreen}
        options={{ title: 'AI gợi ý trả lời tin nhắn' }}
      />
      <AppStackNav.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Cài đặt' }}
      />
      <AppStackNav.Screen
        name="AdminScreen"
        component={AdminScreen}
        options={{ title: 'Quản trị hệ thống' }}
      />
    </AppStackNav.Navigator>
  );
}

/* ---------- 4. DRAWER (Menu mở rộng) ---------- */
function CustomDrawer(props) {
  const { colors } = useTheme();
  const { user, signOut } = useAuth();

  const confirmLogout = () =>
    Alert.alert('Đăng xuất', 'Bạn muốn đăng xuất khỏi tài khoản?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: signOut },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          padding: 20,
          paddingTop: 60,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 208, 0, 0.12)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
            borderWidth: 1,
            borderColor: 'rgba(255, 208, 0, 0.25)',
          }}
        >
          <Image
            source={FAVICON_ICON}
            style={{ width: 52, height: 52, borderRadius: 16, overflow: 'hidden' }}
            resizeMode="contain"
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>
            {user?.name || 'ToolKit User'}
          </Text>
          <RoleBadge role={user?.role} />
        </View>
        <Text style={{ color: colors.sub, marginTop: 4, fontSize: 13 }}>{user?.email}</Text>
      </View>

      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 8 }}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <Pressable
        onPress={confirmLogout}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 20,
          paddingBottom: 40,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        <Text style={{ marginLeft: 12, color: colors.danger, fontWeight: '700', fontSize: 15 }}>
          Đăng xuất
        </Text>
      </Pressable>
    </View>
  );
}

function AppDrawer() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  return (
    <DrawerNav.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        drawerActiveTintColor: '#121214',
        drawerActiveBackgroundColor: colors.primary,
        drawerInactiveTintColor: colors.text,
        drawerLabelStyle: { fontWeight: '700', marginLeft: -8 },
        drawerItemStyle: { borderRadius: 14, marginHorizontal: 12, overflow: 'hidden' },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <DrawerNav.Screen
        name="AppStack"
        component={AppStack}
        options={{
          headerShown: false,
          title: 'Trang chủ ToolKit',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      {isAdmin && (
        <DrawerNav.Screen
          name="DrawerAdmin"
          component={AdminScreen}
          options={{
            title: 'Quản trị hệ thống',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="shield-checkmark-outline" size={size} color="#EF4444" />
            ),
          }}
        />
      )}
      <DrawerNav.Screen
        name="DrawerSettings"
        component={SettingsScreen}
        options={{
          title: 'Cài đặt hệ thống',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </DrawerNav.Navigator>
  );
}

/* ---------- 5. GỐC ---------- */
export default function RootNavigator() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return user ? <AppDrawer /> : <AuthStack />;
}
