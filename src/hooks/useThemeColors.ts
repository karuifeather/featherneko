import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '@/state/store';
import { DARK_HEX, LIGHT_HEX, ACCENT } from '@/constants/designTokens';

/**
 * Resolves effective dark/light from settings (dark | light | system).
 */
export function useIsDark(): boolean {
  const theme = useSelector((state: RootState) => state.settings.theme);
  const systemDark = useColorScheme() === 'dark';
  return theme === 'system' ? systemDark : theme === 'dark';
}

/** Hex colors for use in style={{ }} (StatusBar, TabBar, TextInput, etc.) */
export const THEME_HEX = {
  dark: DARK_HEX,
  light: LIGHT_HEX,
} as const;

/**
 * Theme-aware color tokens for the whole app.
 * Premium: neutral-first, accent used sparingly.
 */
export function useThemeColors() {
  const isDark = useIsDark();
  const hex = isDark ? DARK_HEX : LIGHT_HEX;

  return useMemo(
    () => ({
      isDark,
      hex,
      // Semantic class tokens (for className)
      bg: isDark ? 'bg-[#0a0a0b]' : 'bg-[#fafafa]',
      surface: isDark ? 'bg-[#141416]' : 'bg-white',
      elevated: isDark ? 'bg-[#1c1e21]' : 'bg-[#f4f4f5]',
      text: isDark ? 'text-[#f4f4f5]' : 'text-[#18181b]',
      textSecondary: isDark ? 'text-[#a1a1aa]' : 'text-[#52525b]',
      textTertiary: isDark ? 'text-[#71717a]' : 'text-[#71717a]',
      border: isDark ? 'border-[#2d2f33]' : 'border-[#e4e4e7]',
      inputBg: isDark ? 'bg-[#1c1e21]' : 'bg-white',
      inputBorder: isDark ? 'border-[#2d2f33]' : 'border-[#e4e4e7]',
      placeholder: isDark ? 'text-[#71717a]' : 'text-[#71717a]',
      textOnPrimary: 'text-[#f0f9ff]' as const,
      accent: ACCENT.primary,
      accentForeground: ACCENT.primaryForeground,
      // Legacy aliases
      cardBg: isDark ? 'bg-[#1c1e21]' : 'bg-white',
      subtext: isDark ? 'text-[#a1a1aa]' : 'text-[#52525b]',
      secondary: isDark ? 'text-secondary-dark' : 'text-secondary',
      secondaryBg: isDark ? 'bg-secondary-dark' : 'bg-secondary',
    }),
    [isDark]
  );
}
