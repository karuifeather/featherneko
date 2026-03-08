import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerScrubber } from './PlayerScrubber';
import { SPACING } from '@/constants/designTokens';

interface PlayerBottomControlsProps {
  currentTime: number;
  duration: number;
  bufferedEnd?: number;
  scrubberWidth: number;
  onScrubberLayout: (width: number) => void;
  onSeek?: (x: number) => void;
}

export function PlayerBottomControls({
  currentTime,
  duration,
  bufferedEnd,
  scrubberWidth,
  onScrubberLayout,
  onSeek,
}: PlayerBottomControlsProps) {
  const insets = useSafeAreaInsets();
  const bottomSafe = Math.max(insets.bottom, SPACING.base) + SPACING.lg;

  return (
    <View style={[styles.container, { paddingBottom: bottomSafe }]} pointerEvents="box-none">
      <View style={styles.scrubberWrap}>
        <PlayerScrubber
          currentTime={currentTime}
          duration={duration}
          bufferedEnd={bufferedEnd}
          scrubberWidth={scrubberWidth}
          onScrubberLayout={onScrubberLayout}
          onSeek={onSeek}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
  },
  scrubberWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
  },
});
