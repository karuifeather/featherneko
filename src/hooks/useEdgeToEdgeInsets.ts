import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OVERLAY_HEADER_ROW_HEIGHT } from '@/components/overlay-header';

/** Base height of the tab bar (icons + padding), before adding bottom safe inset. */
export const TAB_BAR_BASE_HEIGHT = 56;

/** Overlay header row padding (slightly reduced for tighter header-to-hero gap). */
const OVERLAY_HEADER_PADDING = 12;

/**
 * Returns safe-area insets and derived values for edge-to-edge layouts.
 * Use for content padding so scroll content doesn't sit under overlay header/tab bar,
 * while the scroll view itself is full-bleed.
 */
export function useEdgeToEdgeInsets() {
  const insets = useSafeAreaInsets();

  const headerRowHeight = OVERLAY_HEADER_ROW_HEIGHT + OVERLAY_HEADER_PADDING;

  return useMemo(
    () => ({
      ...insets,
      /** Total height of the bottom tab bar (base + safe area). Use for ScrollView contentContainerStyle paddingBottom. */
      tabBarHeight: TAB_BAR_BASE_HEIGHT + insets.bottom,
      /** Full overlay header height (status bar + row + padding). Use for screens where content must clear full header. */
      overlayHeaderHeight: insets.top + headerRowHeight,
      /** Header row only (header height minus status bar). Use for content paddingTop when content can extend behind status bar. */
      overlayHeaderRowHeight: headerRowHeight,
    }),
    [insets.top, insets.bottom, insets.left, insets.right]
  );
}
