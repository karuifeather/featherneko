import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '@/hooks/useThemeColors';
import { TYPOGRAPHY, SPACING } from '@/constants/designTokens';
import { ACCENT } from '@/constants/colors';

export interface EpisodeRangeNavProps {
  totalCount: number;
  tabs: { index: number; label: string }[];
  activeIndex: number;
  onTabPress: (index: number) => void;
}

/** Compact integrated header + range selector — section label left, chips right */
export function EpisodeRangeNav({
  totalCount,
  tabs,
  activeIndex,
  onTabPress,
}: EpisodeRangeNavProps) {
  const { hex } = useThemeColors();

  if (tabs.length === 0) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.xs + 2,
        marginBottom: 2,
      }}
    >
      <Text
        style={{
          fontSize: TYPOGRAPHY.caption.fontSize,
          fontWeight: '600',
          color: hex.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {totalCount} Episode{totalCount !== 1 ? 's' : ''}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 4 }}
      >
        {tabs.map(({ index, label }) => {
          const isActive = activeIndex === index;
          return (
            <TouchableOpacity
              key={index}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onTabPress(index);
              }}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderRadius: 4,
                backgroundColor: isActive ? hex.elevated : 'transparent',
                borderBottomWidth: isActive ? 2 : 0,
                borderBottomColor: ACCENT.primary,
              }}
              accessibilityLabel={`Episodes ${label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: isActive ? hex.text : hex.textTertiary,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
