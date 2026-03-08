import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { cleanupPersistentCache } from '@/cache/persistent/eviction';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import store, { persistor } from '@/state/store';
import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import ThemeAwareSystemBars, {
  ThemeAwareBackground,
} from '@/components/theme-aware-system-bars';

export default function RootLayout() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') cleanupPersistentCache().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <SafeAreaProvider>
            <ThemeAwareBackground>
              <ThemeAwareSystemBars />
              <Stack
                screenOptions={{
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              >
                <Stack.Screen name="(root)" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              </Stack>
            </ThemeAwareBackground>
          </SafeAreaProvider>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
}
