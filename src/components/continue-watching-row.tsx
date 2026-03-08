import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import * as Haptics from 'expo-haptics';
import { RootState } from '@/state/store';
import { useThemeColors } from '@/hooks/useThemeColors';
import { LinkButton } from '@/components/ui/link-button';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { TYPOGRAPHY, RADIUS } from '@/constants/designTokens';
import { ACCENT } from '@/constants/colors';

const NOMINAL_EPISODE_DURATION_SEC = 24 * 60; // 24 min typical anime ep

export default function ContinueWatchingRow() {
  const router = useRouter();
  const { text, textSecondary, hex } = useThemeColors();
  const rawEntries = useSelector(
    (state: RootState) => state.continueWatching?.entries
  );
  // Filter valid entries; persist can yield corrupted/partial data in production
  const entries = Array.isArray(rawEntries)
    ? rawEntries.filter(
        (e) =>
          e &&
          typeof e.malId === 'number' &&
          Number.isFinite(e.malId) &&
          e.malId > 0 &&
          e.title &&
          typeof e.episodeNumber === 'number' &&
          (e.coverImage == null || typeof e.coverImage === 'string')
      )
    : [];

  if (entries.length === 0) return null;

  return (
    <View style={{ marginBottom: 28 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          marginBottom: 12,
        }}
      >
        <Text
          className={text}
          style={{
            fontSize: TYPOGRAPHY.sectionTitle.fontSize,
            fontWeight: TYPOGRAPHY.sectionTitle.fontWeight,
            lineHeight: TYPOGRAPHY.sectionTitle.lineHeight,
          }}
        >
          Continue watching
        </Text>
        <LinkButton
          label="See all"
          onPress={() => router.push('/(root)/watch-history')}
          ariaLabel="See all continue watching"
        />
      </View>
      {entries.length > 0 ? (
        <ScrollView
          horizontal
          style={{ marginHorizontal: 16 }}
          contentContainerStyle={{ gap: 14 }}
          showsHorizontalScrollIndicator={false}
        >
          {entries.map((entry) => {
            const progressSec = entry.progressSeconds ?? 0;
            const progress =
              progressSec > 0
                ? Math.min(
                    progressSec / NOMINAL_EPISODE_DURATION_SEC,
                    1
                  )
                : 0;
            return (
              <TouchableOpacity
                key={`cw-${entry.malId}-${entry.episodeNumber}`}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(
                    `/(root)/anime/watch-episode?malId=${entry.malId}&episodeNumber=${entry.episodeNumber}&resumeSeconds=${entry.progressSeconds ?? 0}`
                  );
                }}
                activeOpacity={0.9}
                style={{ width: 120 }}
                accessibilityLabel={`Continue ${entry.title}, episode ${entry.episodeNumber}`}
                accessibilityRole="button"
              >
                <View style={{ position: 'relative', borderRadius: RADIUS.poster, overflow: 'hidden' }}>
                  <ImageWithFallback
                    source={{ uri: entry.coverImage }}
                    style={{
                      width: 120,
                      height: 180,
                      borderRadius: RADIUS.poster,
                    }}
                    resizeMode="cover"
                  />
                  {/* Progress bar */}
                  {progress > 0 && progress < 0.99 && (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        backgroundColor: hex.elevated,
                      }}
                    >
                      <View
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${progress * 100}%`,
                          backgroundColor: ACCENT.primary,
                        }}
                      />
                    </View>
                  )}
                </View>
                <Text
                  className={text}
                  style={{
                    fontSize: TYPOGRAPHY.cardTitle.fontSize - 1,
                    fontWeight: TYPOGRAPHY.cardTitle.fontWeight,
                    marginTop: 6,
                    lineHeight: 19,
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {entry.title}
                </Text>
                <Text
                  className={textSecondary}
                  style={{
                    fontSize: TYPOGRAPHY.caption.fontSize,
                    marginTop: 2,
                  }}
                >
                  Ep {entry.episodeNumber}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
