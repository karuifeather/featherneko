import React from 'react';
import { View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';
import { SPACING, RADIUS } from '@/constants/designTokens';

/** Aspect ratio matching episode card thumbnail — 16:9 */
const THUMB_ASPECT = 16 / 9;

/** Skeleton matching vertical, thumbnail-dominant episode card */
export function EpisodeListSkeleton() {
  return (
    <View style={{ marginBottom: SPACING.md }}>
      {/* Full-width 16:9 thumbnail block */}
      <View style={{ width: '100%', aspectRatio: THUMB_ASPECT }}>
        <Skeleton
          width="100%"
          height="100%"
          borderRadius={RADIUS.sm}
          style={{ borderTopLeftRadius: RADIUS.sm, borderTopRightRadius: RADIUS.sm }}
        />
      </View>
      {/* Info block — title + metadata + action row */}
      <View style={{ paddingHorizontal: SPACING.base, paddingTop: SPACING.sm, paddingBottom: SPACING.sm }}>
        <Skeleton width="90%" height={16} borderRadius={4} />
        <Skeleton width="65%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.sm }}>
          <Skeleton width={64} height={32} borderRadius={RADIUS.button} />
        </View>
      </View>
    </View>
  );
}
