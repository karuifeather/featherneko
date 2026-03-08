import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ACCENT } from '@/constants/colors';
import { DARK_HEX, LIGHT_HEX } from '@/constants/designTokens';
import Logo from '@/components/logo';

const IconMonochrome = require('../../assets/images/android-icon-monochrome.png');
const IconBrand = require('../../assets/images/icon-brand.png');

export const OVERLAY_HEADER_ROW_HEIGHT = 48;

interface OverlayHeaderProps {
  /** Set to false to use solid fallback on Android if blur is problematic. */
  useBlur?: boolean;
}

/**
 * Overlay header with translucent/frosted background matching the bottom tab bar.
 * BlurView + lighter overlay for content visibility behind.
 */
export function OverlayHeader({ useBlur = true }: OverlayHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { elevated, isDark, hex } = useThemeColors();
  const themeHex = isDark ? DARK_HEX : LIGHT_HEX;
  const headerIcon = isDark ? IconMonochrome : IconBrand;
  const logoColor = hex.text;

  const blurOrSolid =
    isDark && useBlur && Platform.OS !== 'web' ? (
      <>
        <BlurView
          intensity={80}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: DARK_HEX.translucentOverlay }]}
        />
      </>
    ) : (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: themeHex.overlayBg }]} />
    );

  return (
    <View style={[styles.wrapper, { borderBottomColor: themeHex.overlayBorder }]} pointerEvents="box-none">
      {blurOrSolid}
      <View style={[styles.borderBottom, { borderBottomColor: themeHex.overlayBorder }]} />
      <View style={[styles.row, { paddingTop: insets.top }]}>
        <View style={styles.rowInner}>
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
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: hex.elevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Open calendar"
          accessibilityRole="button"
        >
          <FontAwesome name="calendar" size={16} color={ACCENT.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailWrapper: {
    position: 'relative',
  },
  borderBottom: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});

export default OverlayHeader;

/** Detail screen header with back button + title. Matches OverlayHeader/TabBar visual style. */
interface DetailOverlayHeaderProps {
  title: string;
  onBack?: () => void;
  useBlur?: boolean;
}

export function DetailOverlayHeader({
  title,
  onBack,
  useBlur = true,
}: DetailOverlayHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { elevated, isDark, hex } = useThemeColors();
  const themeHex = isDark ? DARK_HEX : LIGHT_HEX;

  const blurOrSolid =
    isDark && useBlur && Platform.OS !== 'web' ? (
      <>
        <BlurView
          intensity={80}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: DARK_HEX.translucentOverlay }]}
        />
      </>
    ) : (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: themeHex.overlayBg }]} />
    );

  return (
    <View
      style={[
        styles.wrapper,
        styles.detailWrapper,
        { borderBottomColor: themeHex.overlayBorder },
      ]}
      pointerEvents="box-none"
    >
      {blurOrSolid}
      <View style={[styles.borderBottom, { borderBottomColor: themeHex.overlayBorder }]} />
      <View style={[styles.row, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={onBack ?? (() => router.back())}
          className={`p-2 -ml-2 rounded-lg ${elevated}`}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <FontAwesome name="chevron-left" size={20} color={ACCENT.primary} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            marginLeft: 8,
            fontSize: 18,
            fontWeight: '600',
            color: hex.text,
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
      </View>
    </View>
  );
}
