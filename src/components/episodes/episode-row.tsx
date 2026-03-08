import React from 'react';
import { View, Text, Pressable, TouchableOpacity } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronDown, faChevronUp, faCheck, faPlay } from '@fortawesome/free-solid-svg-icons';
import * as Haptics from 'expo-haptics';

import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { Episode } from '@/types';
import { useThemeColors } from '@/hooks/useThemeColors';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/designTokens';
import { ACCENT } from '@/constants/colors';
import { formatLocalDate } from '@/utils/dateTime';

export interface EpisodeRowProps {
  episode: Episode;
  thumbUri: string;
  isWatched: boolean;
  progressRatio: number;
  isAired: boolean;
  isExpanded: boolean;
  isCurrent?: boolean;
  onPress: () => void;
  onExpandToggle?: () => void;
  onPlayPress: () => void;
}

/** Aspect ratio for thumbnail — YouTube-style 16:9 */
const THUMB_ASPECT = 16 / 9;

export function EpisodeRow({
  episode,
  thumbUri,
  isWatched,
  progressRatio,
  isAired,
  isExpanded,
  isCurrent,
  onPress,
  onExpandToggle,
  onPlayPress,
}: EpisodeRowProps) {
  const { hex } = useThemeColors();

  const num = episode.attributes?.number ?? 0;
  const title = episode.attributes?.canonicalTitle || `Episode ${num}`;
  const hasSynopsis = !!episode.attributes?.synopsis;

  const duration = episode.attributes?.length
    ? `${episode.attributes.length} min`
    : null;
  const metaParts: string[] = [`Ep ${num}`];
  if (episode.attributes?.airdate) {
    const d = new Date(episode.attributes.airdate);
    if (d > new Date()) {
      metaParts.push('Upcoming');
    } else {
      metaParts.push(formatLocalDate(episode.attributes.airdate));
    }
  }
  if (duration) metaParts.push(duration);
  const metaText = metaParts.join(' · ');

  const showProgress = !isWatched && progressRatio > 0 && progressRatio < 0.98;

  return (
    <View
      style={{
        marginBottom: SPACING.sm,
        backgroundColor: isCurrent ? hex.elevated : hex.surface,
        borderRadius: RADIUS.sm,
        overflow: 'hidden',
        borderWidth: 1,
        borderLeftWidth: isCurrent ? 3 : 1,
        borderColor: isCurrent ? ACCENT.primary : hex.border,
      }}
    >
      {/* Thumbnail tap = play / navigate */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.92 : 1,
        })}
        accessibilityLabel={`Episode ${num}: ${title}. ${isAired ? 'Double tap to play' : 'Not yet aired'}`}
        accessibilityRole="button"
      >
        {/* Thumbnail block — full width, 16:9; tap navigates to play */}
        <View
          style={{
            width: '100%',
            aspectRatio: THUMB_ASPECT,
            position: 'relative',
          }}
        >
          <ImageWithFallback
            source={{ uri: thumbUri || '' }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderTopLeftRadius: RADIUS.sm,
              borderTopRightRadius: RADIUS.sm,
            }}
            resizeMode="cover"
            fadeInDuration={220}
          />
          {/* Episode number badge — top-left */}
          <View
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              backgroundColor: 'rgba(0,0,0,0.75)',
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
              Ep {num}
            </Text>
          </View>
          {/* Duration badge — bottom-right */}
          <View
            style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              backgroundColor: 'rgba(0,0,0,0.85)',
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
              {duration ?? '—'}
            </Text>
          </View>
          {/* Progress bar — bottom edge */}
          {showProgress && (
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                backgroundColor: 'rgba(0,0,0,0.5)',
              }}
            >
              <View
                style={{
                  width: `${progressRatio * 100}%`,
                  height: '100%',
                  backgroundColor: ACCENT.primary,
                }}
              />
            </View>
          )}
          {/* Now Playing badge — current episode (prominent) */}
          {isCurrent && (
            <View
              style={{
                position: 'absolute',
                bottom: 6,
                left: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: ACCENT.primary,
              }}
            >
              <FontAwesomeIcon icon={faPlay} size={10} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                Now Playing
              </Text>
            </View>
          )}
          {/* Watched check — bottom-left (small, for previously watched only) */}
          {isWatched && !isCurrent && (
            <View
              style={{
                position: 'absolute',
                bottom: 6,
                left: 6,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: ACCENT.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FontAwesomeIcon icon={faCheck} size={12} color="#fff" />
            </View>
          )}
        </View>

        {/* Info block — title row (title + expand to the right), metadata */}
        <View
          style={{
            paddingHorizontal: SPACING.base,
            paddingTop: SPACING.xs + 2,
            paddingBottom: SPACING.xs + 2,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.xs }}>
            <Text
              style={{
                flex: 1,
                fontSize: TYPOGRAPHY.cardTitle.fontSize,
                fontWeight: TYPOGRAPHY.cardTitle.fontWeight,
                color: hex.text,
                lineHeight: TYPOGRAPHY.cardTitle.lineHeight,
              }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {hasSynopsis && onExpandToggle && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onExpandToggle();
                }}
                hitSlop={8}
                style={{ padding: 4 }}
                accessibilityLabel={isExpanded ? 'Hide summary' : 'Show summary'}
                accessibilityRole="button"
              >
                <FontAwesomeIcon
                  icon={isExpanded ? faChevronUp : faChevronDown}
                  size={14}
                  color={hex.textTertiary}
                />
              </TouchableOpacity>
            )}
          </View>
          <Text
            style={{
              fontSize: TYPOGRAPHY.caption.fontSize,
              color: hex.textTertiary,
              marginTop: 2,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {metaText}
          </Text>
        </View>
      </Pressable>

      {isExpanded && episode.attributes?.synopsis && (
        <View
          style={{
            paddingHorizontal: SPACING.base,
            paddingBottom: SPACING.xs + 2,
            paddingTop: 4,
            borderTopWidth: 1,
            borderTopColor: hex.border,
          }}
        >
          <Text
            style={{
              fontSize: TYPOGRAPHY.caption.fontSize,
              color: hex.textSecondary,
              lineHeight: 18,
            }}
          >
            {episode.attributes.synopsis}
          </Text>
        </View>
      )}
    </View>
  );
}
