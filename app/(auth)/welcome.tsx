import { useRouter } from 'expo-router';
import { View, Text, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/useThemeColors';
import Logo from '@/components/logo';
import BrandButton from '@/components/ui/brand-button';
import '../style.css';
import { BRAND } from '@/constants/colors';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bg, text, subtext } = useThemeColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View className={`flex-1 ${bg}`} style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="absolute inset-0">
        <View className="absolute top-[-20%] right-[-10%] w-80 h-80 rounded-full opacity-[0.08]" style={{ backgroundColor: BRAND.primary }} />
        <View className="absolute bottom-[10%] left-[-15%] w-72 h-72 rounded-full opacity-[0.06]" style={{ backgroundColor: BRAND.primary }} />
      </View>

      <View className="flex-1 justify-center items-center px-8">
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
          <View className="mb-6">
            <Logo width={180} color={BRAND.primary} />
          </View>
          <Text className={`${text} text-xl font-semibold text-center max-w-[280px] leading-7`}>
            Your anime watchlist, progress, and episodes in one place.
          </Text>
          <Text className={`${subtext} text-base text-center mt-3 max-w-[260px] leading-5`}>
            Discover, track, and pick up where you left off.
          </Text>
          <Text className={`${subtext} text-sm text-center mt-4 opacity-80`}>
            Access requires a password from karuifeather.com
          </Text>
        </Animated.View>

        <View className="w-full mt-14 px-2">
          <BrandButton
            label="Get started"
            onPress={() => router.push('./onboarding/')}
            fullWidth
            style={{ minHeight: 56 }}
          />
        </View>

        <Text className={`${subtext} text-xs mt-8 opacity-70`}>
          FeatherNeko by karuifeather.com
        </Text>
      </View>
    </View>
  );
}
