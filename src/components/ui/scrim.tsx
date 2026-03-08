import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/hooks/useThemeColors';
import { DARK_HEX, LIGHT_HEX } from '@/constants/designTokens';

/** Height of top/bottom scrim gradients (readability over content). */
export const SCRIM_TOP_HEIGHT = 72;
export const SCRIM_BOTTOM_HEIGHT = 96;

export type ScrimVariant = 'default' | 'light';

interface ScrimProps {
  /** 'top' | 'bottom' */
  position: 'top' | 'bottom';
  /** Slightly lighter overlay when variant is 'light'. */
  variant?: ScrimVariant;
  /** Override height; default SCRIM_TOP_HEIGHT / SCRIM_BOTTOM_HEIGHT. */
  height?: number;
  /** Pointer events: 'none' so touches pass through to content. */
  pointerEvents?: 'box-none' | 'none' | 'auto' | 'box-only';
}

/** Subtle dark gradient overlay for readability over full-bleed content (e.g. status bar or nav area). YouTube-style. */
export function Scrim({ position, variant = 'default', height, pointerEvents = 'none' }: ScrimProps) {
  const isDark = useThemeColors().isDark;
  const themeHex = isDark ? DARK_HEX : LIGHT_HEX;
  const start = themeHex.heroGradientStart;
  const end = variant === 'light' ? themeHex.scrimLight : themeHex.scrim;
  const h = height ?? (position === 'top' ? SCRIM_TOP_HEIGHT : SCRIM_BOTTOM_HEIGHT);

  const colors = position === 'top' ? [end, start] : [start, end];

  return (
    <View
      style={[position === 'top' ? styles.top : styles.bottom, { height: h }]}
      pointerEvents={pointerEvents}
    >
      <LinearGradient
        colors={colors}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
