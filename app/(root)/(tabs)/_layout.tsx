import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TranslucentTabBar } from '@/components/translucent-tab-bar';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ACCENT } from '@/constants/colors';

export default function TabLayout() {
  const { hex } = useThemeColors();

  return (
    <Tabs
      tabBar={(props) => <TranslucentTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingTop: 8,
        },
        tabBarActiveTintColor: ACCENT.primary,
        tabBarInactiveTintColor: hex.tabBarInactive,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bookmark" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
