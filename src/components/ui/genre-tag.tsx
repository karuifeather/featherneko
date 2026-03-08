import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/hooks/useThemeColors';
import { TYPOGRAPHY, RADIUS } from '@/constants/designTokens';

type GenreTagProps = {
  label: string;
};

export function GenreTag({ label }: GenreTagProps) {
  const { hex } = useThemeColors();
  const router = useRouter();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(root)/anime/genre/${encodeURIComponent(label)}`);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: RADIUS.pill,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: hex.border,
      }}
      accessibilityLabel={`Browse ${label} anime`}
      accessibilityRole="button"
    >
      <Text
        style={{
          fontSize: TYPOGRAPHY.pillLabel.fontSize - 1,
          fontWeight: '600',
          color: hex.textSecondary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
