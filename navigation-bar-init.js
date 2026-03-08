/**
 * Set Android navigation bar transparent as early as possible, before React mounts.
 * This fixes the nav bar appearing opaque on cold start and only becoming
 * translucent after switching apps. The native window may not be ready on first
 * call, so we retry at increasing delays.
 */
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

function applyTransparent() {
  NavigationBar.setBackgroundColorAsync('transparent').catch(() => {});
  // Light icons for dark theme (app default); avoids system contrast scrim
  NavigationBar.setStyle('light');
}

if (Platform.OS === 'android') {
  applyTransparent();
  // Retry: on cold start the native window may not be ready; re-apply at intervals
  [150, 400, 800, 1200].forEach((ms) => setTimeout(applyTransparent, ms));
}
