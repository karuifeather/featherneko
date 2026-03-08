/**
 * Brand and color tokens.
 * Use ACCENT sparingly; prefer theme tokens from useThemeColors.
 */

export { ACCENT, SEMANTIC, DARK_HEX, LIGHT_HEX } from './designTokens';

/** Legacy alias — use ACCENT or theme tokens */
export const BRAND = {
  primary: '#4a7c7c',
  primaryForeground: '#f0f9ff',
  primaryDark: '#3d6969',
  secondary: '#669999',
  secondaryDark: '#cc6666',
  destructive: '#EF4444',
  subtext: '#9CA3AF',
} as const;
