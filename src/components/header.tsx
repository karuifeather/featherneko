import { View, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ACCENT } from '@/constants/colors';
import Logo from '@/components/logo';

const IconMonochrome = require('../../assets/images/android-icon-monochrome.png');
const IconBrand = require('../../assets/images/icon-brand.png');

const Header = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { surface, elevated, border, isDark, hex } = useThemeColors();
  const headerIcon = isDark ? IconMonochrome : IconBrand;
  const logoColor = isDark ? hex.text : hex.text;
  return (
    <View
      className={`flex-row items-center justify-between px-4 py-3 ${surface} border-b ${border}`}
      style={{ paddingTop: insets.top + 12 }}
    >
      <View className="flex-row items-center gap-3">
        <Image
          source={headerIcon}
          style={{ width: 32, height: 32 }}
          resizeMode="contain"
        />
        <Logo
          color={logoColor}
          height={20}
          accessibilityLabel="FeatherNeko"
        />
      </View>
      <TouchableOpacity
        onPress={() => router.push('/(root)/anime/calendar')}
        className={`px-3 py-2.5 rounded-lg ${elevated}`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Open calendar"
        accessibilityRole="button"
      >
        <FontAwesome name="calendar" size={18} color={ACCENT.primary} />
      </TouchableOpacity>
    </View>
  );
};

export default Header;
