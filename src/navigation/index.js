import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { DrawerActions } from '@react-navigation/native';
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
import ToolsScreen from '../screens/ToolsScreen';
import AccountScreen from '../screens/AccountScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ComingSoonScreen from '../screens/ComingSoonScreen';
import ImageToPdfScreen from '../screens/ImageToPdfScreen';

const AuthStackNav = createNativeStackNavigator();
const AppStackNav = createNativeStackNavigator();
const TabNav = createBottomTabNavigator();
const DrawerNav = createDrawerNavigator();

/* ---------- 1. STACK (chưa đăng nhập) ---------- */
function AuthStack() {
  return (
    <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
    </AuthStackNav.Navigator>
  );
}

/* ---------- 2. TAB (3 tab chính) ---------- */
const TAB_ICONS = {
  Home: ['home', 'home-outline'],
  Tools: ['grid', 'grid-outline'],
  Account: ['person', 'person-outline'],
};

function Tabs() {
  const { colors } = useTheme();
  return (
    <TabNav.Navigator
      screenOptions={({ navigation, route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        // nút ☰ mở Drawer
        headerLeft: () => (
          <Pressable
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={{ marginLeft: 16 }}
            hitSlop={10}
          >
            <Ionicons name="menu" size={26} color={colors.text} />
          </Pressable>
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.sub,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <TabNav.Screen name="Home" component={HomeScreen} options={{ title: 'My Toolbox', tabBarLabel: 'Trang chủ' }} />
      <TabNav.Screen name="Tools" component={ToolsScreen} options={{ title: 'Tiện ích', tabBarLabel: 'Tiện ích' }} />
      <TabNav.Screen name="Account" component={AccountScreen} options={{ title: 'Cá nhân', tabBarLabel: 'Cá nhân' }} />
    </TabNav.Navigator>
  );
}

/* ---------- 3. STACK (Tab + các màn tiện ích đẩy lên trên) ---------- */
function AppStack() {
  const { colors } = useTheme();
  return (
    <AppStackNav.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <AppStackNav.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <AppStackNav.Screen name="ImageToPdf" component={ImageToPdfScreen} options={{ title: 'Ảnh → PDF' }} />
      <AppStackNav.Screen
        name="ComingSoon"
        component={ComingSoonScreen}
        options={({ route }) => ({ title: route.params?.tool?.title ?? 'Sắp có' })}
      />
    </AppStackNav.Navigator>
  );
}

/* ---------- 4. DRAWER (menu trượt bên trái) ---------- */
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
      <LinearGradient
        colors={[colors.primary2, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 20, paddingTop: 70 }}
      >
        <View
          style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: 'rgba(255,255,255,0.25)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>
            {user.name[0].toUpperCase()}
          </Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{user.name}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{user.email}</Text>
      </LinearGradient>

      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 8 }}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <Pressable
        onPress={confirmLogout}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 40 }}
      >
        <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        <Text style={{ marginLeft: 12, color: colors.danger, fontWeight: '600', fontSize: 15 }}>
          Đăng xuất
        </Text>
      </Pressable>
    </View>
  );
}

function AppDrawer() {
  const { colors } = useTheme();
  return (
    <DrawerNav.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        drawerActiveTintColor: colors.primary,
        drawerActiveBackgroundColor: colors.primary + '1A',
        drawerInactiveTintColor: colors.text,
        drawerLabelStyle: { fontWeight: '600', marginLeft: -8 },
        drawerItemStyle: { borderRadius: 12, marginHorizontal: 12 },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <DrawerNav.Screen
        name="AppStack"
        component={AppStack}
        options={{
          headerShown: false,
          title: 'Trang chủ',
          drawerIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <DrawerNav.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Cài đặt',
          drawerIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </DrawerNav.Navigator>
  );
}

/* ---------- GỐC: chưa đăng nhập → Login, đã đăng nhập → Drawer ---------- */
export default function RootNavigator() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return user ? <AppDrawer /> : <AuthStack />;
}
