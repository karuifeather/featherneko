import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPlay, faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { TYPOGRAPHY, SPACING } from '@/constants/designTokens';

export type PlayerStateOverlayVariant =
  | 'pre-play'
  | 'buffering'
  | 'error';

interface PlayerStateOverlayProps {
  variant: PlayerStateOverlayVariant;
  onTapToPlay?: () => void;
  onRetry?: () => void;
  errorMessage?: string | null;
}

export function PlayerStateOverlay({
  variant,
  onTapToPlay,
  onRetry,
  errorMessage,
}: PlayerStateOverlayProps) {
  if (variant === 'pre-play') {
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={onTapToPlay}
        style={styles.prePlayContainer}
        accessibilityLabel="Tap to play"
        accessibilityRole="button"
      >
        <View style={styles.playIconWrapper}>
          <FontAwesomeIcon icon={faPlay} size={28} color="#0a0a0b" />
        </View>
        <Text style={styles.tapToPlayText}>Tap to play</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'buffering') {
    return (
      <View style={styles.bufferingContainer} pointerEvents="none">
        <View style={styles.bufferingPill}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      </View>
    );
  }

  if (variant === 'error') {
    return (
      <View style={styles.errorContainer}>
        <FontAwesomeIcon
          icon={faCircleExclamation}
          size={32}
          color="rgba(255,255,255,0.6)"
        />
        <Text style={styles.errorText} numberOfLines={2}>
          {errorMessage ?? 'Something went wrong'}
        </Text>
        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            style={styles.retryButton}
            accessibilityLabel="Retry"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  prePlayContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  playIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapToPlayText: {
    ...TYPOGRAPHY.metadata,
    color: 'rgba(255,255,255,0.85)',
    marginTop: SPACING.md,
    fontSize: 13,
  },
  bufferingContainer: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
  },
  bufferingPill: {
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: SPACING.md,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: SPACING.md,
    fontSize: 14,
  },
  retryButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
  },
  retryText: {
    ...TYPOGRAPHY.buttonLabel,
    color: '#fff',
    fontSize: 14,
  },
});
