import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft, faExpand } from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { TYPOGRAPHY, SPACING } from '@/constants/designTokens';

interface PlayerTopBarProps {
  onBack: () => void;
  animeTitle?: string | null;
  episodeTitle?: string | null;
  episodeNumber?: number | null;
  onFullscreen?: () => void;
}

export function PlayerTopBar({
  onBack,
  animeTitle,
  episodeTitle,
  episodeNumber,
  onFullscreen,
}: PlayerTopBarProps) {
  const insets = useSafeAreaInsets();
  const topSafe = insets.top + SPACING.sm;

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  };

  const line1 = animeTitle ?? 'Anime';
  const line2 =
    episodeTitle && episodeTitle.trim()
      ? episodeTitle
      : episodeNumber != null
        ? `Episode ${episodeNumber}`
        : null;

  return (
    <View style={[styles.container, { paddingTop: topSafe }]} pointerEvents="box-none">
      <View style={styles.row}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <FontAwesomeIcon icon={faChevronLeft} size={20} color="rgba(255,255,255,0.95)" />
        </TouchableOpacity>
        <View style={styles.titleStack} pointerEvents="none">
          <Text
            style={styles.titleLine1}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {line1}
          </Text>
          {line2 ? (
            <Text
              style={styles.titleLine2}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {line2}
            </Text>
          ) : null}
        </View>
        {onFullscreen && (
          <TouchableOpacity
            onPress={onFullscreen}
            style={styles.fullscreenButton}
            hitSlop={8}
            accessibilityLabel="Fullscreen"
            accessibilityRole="button"
          >
            <FontAwesomeIcon icon={faExpand} size={16} color="rgba(255,255,255,0.95)" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleStack: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  titleLine1: {
    ...TYPOGRAPHY.cardTitle,
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
  },
  titleLine2: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 2,
    fontSize: 13,
  },
  fullscreenButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
