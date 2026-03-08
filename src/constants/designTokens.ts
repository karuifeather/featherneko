/**
 * Premium design system tokens.
 * Used for consistent, cinematic, content-first UI.
 * Accent (teal) used sparingly — neutral-first palette.
 */

/** Accent color — used for active selection, CTA, progress, loading only */
export const ACCENT = {
  primary: '#4a7c7c',
  primaryForeground: '#f0f9ff',
  primaryDark: '#3d6969',
} as const;

/** Semantic colors */
export const SEMANTIC = {
  destructive: '#EF4444',
  success: '#22c55e',
  warning: '#f59e0b',
} as const;

/** Dark mode — near-black, deep charcoal, premium */
export const DARK_HEX = {
  /** Near-black page background */
  bg: '#0a0a0b',
  /** Slightly lifted surface */
  surface: '#141416',
  /** Elevated / cards */
  elevated: '#1c1e21',
  /** Subtle border */
  border: '#2d2f33',
  /** Primary text — soft off-white */
  text: '#f4f4f5',
  /** Secondary — muted gray */
  textSecondary: '#a1a1aa',
  /** Alias */
  subtext: '#a1a1aa',
  /** Tertiary — dimmer */
  textTertiary: '#71717a',
  /** Tab bar */
  tabBarBg: '#0a0a0b',
  tabBarBorder: '#1c1e21',
  tabBarInactive: '#71717a',
  /** Translucent overlay (header, tab bar) — subtle content visibility behind */
  overlayBg: 'rgba(10,10,11,0.96)',
  overlayBorder: 'rgba(45,47,51,0.92)',
  /** Card / surface for lists */
  card: '#1c1e21',
  /** Input */
  inputBg: '#1c1e21',
  /** Skeleton shimmer */
  skeletonBase: '#1c1e21',
  skeletonHighlight: '#2d2f33',
  /** Overlay/scrim — subtle, translucent (readability over full-bleed content) */
  scrim: 'rgba(0,0,0,0.82)',
  scrimLight: 'rgba(0,0,0,0.62)',
  /** Hero gradient over image */
  heroGradientStart: 'transparent',
  heroGradientEnd: 'rgba(0,0,0,0.92)',
  /** Card overlay for text readability */
  cardOverlay: 'rgba(0,0,0,0.7)',
  /** Translucent bar overlay (tab bar, header, nav bar) — blur + light tint for content behind */
  translucentOverlay: 'rgba(18,18,20,0.38)',
  /** Solid hex for Android nav bar (setBackgroundColorAsync doesn't support rgba) — matches translucentOverlay */
  translucentOverlaySolid: '#121214',
} as const;

/** Light mode — clean, soft neutrals */
export const LIGHT_HEX = {
  bg: '#fafafa',
  surface: '#ffffff',
  elevated: '#f4f4f5',
  border: '#e4e4e7',
  text: '#18181b',
  textSecondary: '#52525b',
  subtext: '#52525b',
  textTertiary: '#71717a',
  tabBarBg: '#ffffff',
  tabBarBorder: '#e4e4e7',
  tabBarInactive: '#71717a',
  overlayBg: 'rgba(252,252,252,0.96)',
  overlayBorder: 'rgba(228,228,231,0.94)',
  card: '#ffffff',
  inputBg: '#ffffff',
  skeletonBase: '#e4e4e7',
  skeletonHighlight: '#f4f4f5',
  scrim: 'rgba(0,0,0,0.72)',
  scrimLight: 'rgba(0,0,0,0.48)',
  heroGradientStart: 'transparent',
  heroGradientEnd: 'rgba(0,0,0,0.85)',
  cardOverlay: 'rgba(0,0,0,0.65)',
} as const;

/** Typography scale — semantic styles */
export const TYPOGRAPHY = {
  heroTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  metadata: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  helper: {
    fontSize: 11,
    fontWeight: '400' as const,
    lineHeight: 14,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
} as const;

/** Spacing scale (4px base) */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

/** Border radius */
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  poster: 10,
  card: 12,
  button: 12,
  pill: 999,
  modal: 24,
} as const;
