import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Scrim, SCRIM_TOP_HEIGHT, SCRIM_BOTTOM_HEIGHT } from '@/components/ui/scrim';
import type { ScrimVariant } from '@/components/ui/scrim';

export interface ScreenContainerProps {
  children: React.ReactNode;
  /** Apply top safe-area inset to content (e.g. under status bar). Default true. */
  includeTopInset?: boolean;
  /** Apply bottom safe-area inset to content (e.g. above nav bar). Default true. */
  includeBottomInset?: boolean;
  /** Optional top gradient scrim for readability over full-bleed content. */
  topScrim?: boolean | ScrimVariant;
  /** Optional bottom gradient scrim. */
  bottomScrim?: boolean | ScrimVariant;
  /** Outer container style (full-bleed background). */
  style?: ViewStyle;
  /** Inner content area style (after insets). */
  contentStyle?: ViewStyle;
}

/**
 * Edge-to-edge screen wrapper: background is full-bleed; content respects safe-area insets.
 * Use for screens where content (or media) should extend behind status bar / nav bar,
 * while interactive UI (headers, tabs, buttons) stays within safe areas.
 *
 * - Set includeTopInset: false when you have a custom header that applies its own top inset.
 * - Set includeBottomInset: false when the screen has a tab bar that applies its own bottom inset.
 * - Use topScrim / bottomScrim for media-heavy or hero screens (YouTube-style).
 */
export function ScreenContainer({
  children,
  includeTopInset = true,
  includeBottomInset = true,
  topScrim = false,
  bottomScrim = false,
  style,
  contentStyle,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  const paddingTop = includeTopInset ? insets.top : 0;
  const paddingBottom = includeBottomInset ? insets.bottom : 0;

  const topScrimVariant = topScrim === true ? 'default' : topScrim === false ? undefined : topScrim;
  const bottomScrimVariant = bottomScrim === true ? 'default' : bottomScrim === false ? undefined : bottomScrim;

  return (
    <View style={[styles.outer, style]}>
      <View
        style={[
          styles.content,
          { paddingTop, paddingBottom },
          contentStyle,
        ]}
      >
        {children}
      </View>
      {topScrimVariant != null && (
        <Scrim position="top" variant={topScrimVariant} />
      )}
      {bottomScrimVariant != null && (
        <Scrim position="bottom" variant={bottomScrimVariant} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  edgeToEdge: {
    flex: 1,
  },
});

/** Props for edge-to-edge immersive layout (content behind system bars + overlays). */
export interface EdgeToEdgeScreenProps {
  children: React.ReactNode;
  /** Overlay UI (e.g. OverlayHeader) rendered on top of content. */
  overlay?: React.ReactNode;
  /** Optional top scrim for readability. */
  topScrim?: boolean;
  /** Optional bottom scrim. */
  bottomScrim?: boolean;
  style?: ViewStyle;
}

/**
 * Full-bleed screen wrapper for YouTube-style edge-to-edge: content is the first layer,
 * then optional overlay (header), then optional scrims. Use for feed/media screens
 * where content scrolls behind the header and tab bar.
 */
export function EdgeToEdgeScreen({
  children,
  overlay,
  topScrim = false,
  bottomScrim = false,
  style,
}: EdgeToEdgeScreenProps) {
  return (
    <View style={[styles.edgeToEdge, style]}>
      {children}
      {overlay}
      {topScrim && <Scrim position="top" />}
      {bottomScrim && <Scrim position="bottom" />}
    </View>
  );
}

export { SCRIM_TOP_HEIGHT, SCRIM_BOTTOM_HEIGHT };
