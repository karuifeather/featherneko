import { useEffect } from 'react';
import { AppState, NativeModules, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useIsDark, THEME_HEX } from '@/hooks/useThemeColors';

export const DARK_BG = '#111827'; // gray-900
export const LIGHT_BG = '#f3f4f6'; // gray-100

const { ImmersiveMode } = NativeModules;

function applyAndroidNavBar() {
  if (Platform.OS !== 'android') return;
  // Use native module — expo-navigation-bar JS API is ignored with edge-to-edge.
  // MainActivity.onCreate handles cold start; this handles app resume.
  ImmersiveMode?.setNavBarTransparent?.();
}

/** Wraps the app so the area behind the status bar uses theme color. */
export function ThemeAwareBackground({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDark = useIsDark();
  const bg = isDark ? THEME_HEX.dark.bg : THEME_HEX.light.bg;
  return <View style={{ flex: 1, backgroundColor: bg }}>{children}</View>;
}

/** Global status and navigation bar config. Android: transparent nav bar so our
 * tab bar (solid tabBarBg) shows through for unified bottom bar. */
export default function ThemeAwareSystemBars() {
  const isDark = useIsDark();
  const bg = isDark ? THEME_HEX.dark.bg : THEME_HEX.light.bg;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(bg);
    if (Platform.OS === 'android') {
      applyAndroidNavBar();
    }
  }, [isDark, bg]);

  // Re-apply when app becomes active (return from background) — the system
  // re-applies its scrim, so we call the native module to override it.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        applyAndroidNavBar();
        setTimeout(applyAndroidNavBar, 150);
      }
    });
    return () => sub.remove();
  }, [isDark]);

  return (
    <StatusBar
      style={isDark ? 'light' : 'dark'}
      translucent={Platform.OS === 'android'}
      backgroundColor="transparent"
    />
  );
}
