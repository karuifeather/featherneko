import React, { useEffect } from 'react';
import { View, Animated, Dimensions } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  className?: string;
  style?: Record<string, unknown>;
}

/** Single shimmer block */
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 6,
  className = '',
  style,
}: SkeletonProps) {
  const { hex } = useThemeColors();
  const shimmer = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.7],
  });

  return (
    <View
      className={className}
      style={[
        {
          width: typeof width === 'string' ? width : width,
          height: typeof height === 'number' ? height : 20,
          borderRadius,
          backgroundColor: hex.skeletonBase,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: hex.skeletonHighlight,
          borderRadius,
          opacity,
        }}
      />
    </View>
  );
}

/** Hero skeleton — matches hero layout */
export function HeroSkeleton() {
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const heroWidth = SCREEN_WIDTH * 0.9;
  const heroHeight = 220;

  return (
    <View style={{ marginBottom: 24, alignItems: 'center' }}>
      <Skeleton
        width={heroWidth}
        height={heroHeight}
        borderRadius={14}
      />
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, justifyContent: 'center' }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} width={8} height={8} borderRadius={4} />
        ))}
      </View>
    </View>
  );
}

/** Poster card skeleton — for shelves */
export function PosterSkeleton({ width = 128, height = 192 }: { width?: number; height?: number }) {
  return (
    <View style={{ width, marginRight: 14 }}>
      <Skeleton width={width} height={height} borderRadius={10} />
      <View style={{ marginTop: 8 }}>
        <Skeleton width={width - 8} height={14} borderRadius={4} />
      </View>
    </View>
  );
}

/** Search result card skeleton */
export function SearchResultSkeleton() {
  return (
    <View style={{ flexDirection: 'row', padding: 12, marginBottom: 10, gap: 12 }}>
      <Skeleton width={96} height={136} borderRadius={10} />
      <View style={{ flex: 1 }}>
        <Skeleton width="80%" height={18} borderRadius={6} />
        <Skeleton width="60%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
        <Skeleton width="90%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

/** Shelf row skeleton */
export function ShelfRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={{ marginBottom: 28 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 16 }}>
        <Skeleton width={140} height={22} borderRadius={6} />
        <Skeleton width={56} height={16} borderRadius={4} />
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 16 }}>
        {Array.from({ length: count }).map((_, i) => (
          <PosterSkeleton key={i} width={120} height={180} />
        ))}
      </View>
    </View>
  );
}
