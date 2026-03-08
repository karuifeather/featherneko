import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faPlay,
  faPause,
  faBackward,
  faForward,
} from '@fortawesome/free-solid-svg-icons';
import { SPACING } from '@/constants/designTokens';

interface PlayerCenterControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkipBack?: () => void;
  onSkipForward?: () => void;
}

export function PlayerCenterControls({
  isPlaying,
  onPlayPause,
  onSkipBack,
  onSkipForward,
}: PlayerCenterControlsProps) {
  const showSkipButtons = onSkipBack != null && onSkipForward != null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.row}>
        {showSkipButtons && (
          <TouchableOpacity
            onPress={onSkipBack}
            style={styles.skipButton}
            hitSlop={8}
            accessibilityLabel="Skip back 10 seconds"
            accessibilityRole="button"
          >
            <View style={styles.skipCircle}>
              <FontAwesomeIcon icon={faBackward} size={14} color="rgba(255,255,255,0.92)" />
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onPlayPause}
          style={styles.playButton}
          hitSlop={8}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          accessibilityRole="button"
        >
          <FontAwesomeIcon
            icon={isPlaying ? faPause : faPlay}
            size={18}
            color="#0a0a0b"
          />
        </TouchableOpacity>

        {showSkipButtons && (
          <TouchableOpacity
            onPress={onSkipForward}
            style={styles.skipButton}
            hitSlop={8}
            accessibilityLabel="Skip forward 10 seconds"
            accessibilityRole="button"
          >
            <View style={styles.skipCircle}>
              <FontAwesomeIcon icon={faForward} size={14} color="rgba(255,255,255,0.92)" />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  skipButton: {
    padding: 4,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
