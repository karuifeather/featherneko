import React from 'react';
import { View, Text, Pressable, LayoutChangeEvent, StyleSheet } from 'react-native';
import { TYPOGRAPHY } from '@/constants/designTokens';
import { ACCENT } from '@/constants/colors';

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface PlayerScrubberProps {
  currentTime: number;
  duration: number;
  /** End of buffered range in seconds (how far ahead is loaded) */
  bufferedEnd?: number;
  scrubberWidth: number;
  onScrubberLayout: (width: number) => void;
  onSeek?: (x: number) => void;
}

export function PlayerScrubber({
  currentTime,
  duration,
  bufferedEnd,
  scrubberWidth,
  onScrubberLayout,
  onSeek,
}: PlayerScrubberProps) {
  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const bufferedRatio =
    duration > 0 && bufferedEnd != null && bufferedEnd > 0
      ? Math.min(1, bufferedEnd / duration)
      : 0;

  return (
    <View style={styles.container}>
      {/* Inline: time left | progress bar | time right */}
      <View style={styles.timeAndTrackRow}>
        <View style={[styles.timePill, { flexShrink: 0 }]}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        </View>
        <Pressable
          onLayout={(e: LayoutChangeEvent) =>
            onScrubberLayout(e.nativeEvent.layout.width)
          }
          onPress={onSeek ? (e) => onSeek(e.nativeEvent.locationX) : undefined}
          style={styles.trackHitArea}
          accessibilityLabel={
            onSeek
              ? `Seek. ${formatTime(currentTime)} of ${formatTime(duration)}`
              : `Progress. ${formatTime(currentTime)} of ${formatTime(duration)}`
          }
          accessibilityRole={onSeek ? 'adjustable' : 'none'}
        >
          <View style={styles.track}>
            {bufferedRatio > 0 && (
              <View
                style={[
                  styles.bufferedFill,
                  { width: `${bufferedRatio * 100}%` },
                ]}
              />
            )}
            <View
              style={[
                styles.progressFill,
                { width: `${progressRatio * 100}%` },
              ]}
            />
          </View>
        </Pressable>
        <View style={[styles.timePill, { flexShrink: 0 }]}>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  timeAndTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    minHeight: 44,
  },
  timePill: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  trackHitArea: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    minWidth: 0,
    marginHorizontal: 4,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  bufferedFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 2,
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: ACCENT.primary,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timeElapsed: {
    ...TYPOGRAPHY.caption,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  timeTotal: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
});
