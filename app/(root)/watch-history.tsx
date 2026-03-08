import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft, faPlay, faTrash } from '@fortawesome/free-solid-svg-icons';
import * as Haptics from 'expo-haptics';
import { RootState } from '@/state/store';
import { removeContinueWatching } from '@/state/continueWatchingSlice';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { SmartTitle } from '@/components/smart-title';
import { BrandButton } from '@/components/ui/brand-button';
import { TYPOGRAPHY, RADIUS, SPACING } from '@/constants/designTokens';
import { ACCENT, SEMANTIC } from '@/constants/colors';

const NOMINAL_EPISODE_DURATION_SEC = 24 * 60;

export default function ContinueWatchingScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const entries = useSelector(
    (state: RootState) => state.continueWatching.entries
  );
  const { bg, text, textSecondary, hex } = useThemeColors();

  if (entries.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: hex.bg }}>
        {/* Header — status bar clearance */}
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 12,
            paddingHorizontal: SPACING.base,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: hex.border,
            backgroundColor: hex.surface,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: hex.elevated,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
            hitSlop={8}
          >
            <FontAwesomeIcon icon={faChevronLeft} size={18} color={hex.text} />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: TYPOGRAPHY.screenTitle.fontSize,
              fontWeight: '700',
              color: hex.text,
            }}
          >
            Continue watching
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 40,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: 'rgba(74, 124, 124, 0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <FontAwesomeIcon icon={faPlay} size={36} color={ACCENT.primary} />
          </View>
          <Text
            style={{
              fontSize: TYPOGRAPHY.screenTitle.fontSize,
              fontWeight: '700',
              color: hex.text,
              textAlign: 'center',
            }}
          >
            Nothing in progress
          </Text>
          <Text
            style={{
              fontSize: TYPOGRAPHY.body.fontSize,
              color: hex.textSecondary,
              textAlign: 'center',
              marginTop: 12,
              lineHeight: 22,
              maxWidth: 280,
            }}
          >
            Start watching an episode and it will show up here so you can pick up where you left off.
          </Text>
          <BrandButton
            label="Browse home"
            onPress={() => router.replace('/(root)/(tabs)/home')}
            className="mt-10"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: hex.bg }}>
      {/* Header — status bar clearance */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: SPACING.base,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: hex.border,
          backgroundColor: hex.surface,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: hex.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
          hitSlop={8}
        >
          <FontAwesomeIcon icon={faChevronLeft} size={18} color={hex.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: TYPOGRAPHY.screenTitle.fontSize,
              fontWeight: '700',
              color: hex.text,
            }}
          >
            Continue watching
          </Text>
          <Text
            style={{
              fontSize: TYPOGRAPHY.caption.fontSize,
              color: hex.textTertiary,
              marginTop: 2,
            }}
          >
            {entries.length} show{entries.length !== 1 ? 's' : ''} — tap to resume
          </Text>
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => `cw-${item.malId}-${item.episodeNumber}`}
        contentContainerStyle={{
          paddingHorizontal: SPACING.base,
          paddingTop: SPACING.base,
          paddingBottom: insets.bottom + 80,
        }}
        renderItem={({ item }) => {
          const progressSec = item.progressSeconds ?? 0;
          const progress =
            progressSec > 0
              ? Math.min(progressSec / NOMINAL_EPISODE_DURATION_SEC, 1)
              : 0;
          const showProgress = progress > 0 && progress < 0.99;

          return (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(
                  `/(root)/anime/watch-episode?malId=${item.malId}&episodeNumber=${item.episodeNumber}&resumeSeconds=${item.progressSeconds ?? 0}`
                );
              }}
              activeOpacity={0.9}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: hex.surface,
                borderRadius: RADIUS.card,
                marginBottom: SPACING.sm,
                paddingVertical: SPACING.sm,
                paddingLeft: 0,
                paddingRight: SPACING.sm,
                borderWidth: 1,
                borderColor: hex.border,
              }}
            >
              <View style={{ position: 'relative', borderRadius: RADIUS.sm, overflow: 'hidden' }}>
                <ImageWithFallback
                  source={{ uri: item.coverImage }}
                  style={{
                    width: 56,
                    height: 80,
                    borderRadius: RADIUS.sm,
                  }}
                  resizeMode="cover"
                />
                {showProgress && (
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
              <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                <SmartTitle
                  title={item.title}
                  maxLines={2}
                  className={`${text} font-semibold`}
                />
                <Text
                  style={{
                    fontSize: TYPOGRAPHY.caption.fontSize,
                    color: hex.textTertiary,
                    marginTop: 2,
                  }}
                >
                  Ep {item.episodeNumber}
                </Text>
              </View>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  dispatch(removeContinueWatching(item.malId));
                }}
                hitSlop={12}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FontAwesomeIcon icon={faTrash} size={14} color={SEMANTIC.destructive} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
