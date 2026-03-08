import { SelectedAnimeProvider } from '@/context/anime-provider';
import EpisodeProvider from '@/context/episode-provider';
import { Stack } from 'expo-router';

/** Root (main app) layout. No SafeAreaView here — content can render edge-to-edge;
 * individual screens/header/tab bar apply safe-area insets where needed. */
export default function RootLayout() {
  return (
    <SelectedAnimeProvider>
      <EpisodeProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            gestureEnabled: true,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
      </EpisodeProvider>
    </SelectedAnimeProvider>
  );
}
