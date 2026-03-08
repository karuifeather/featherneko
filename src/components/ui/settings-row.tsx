import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/hooks/useThemeColors';
import { TYPOGRAPHY } from '@/constants/designTokens';

interface SettingsRowProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
  accessibilityLabel?: string;
}

/** Premium settings row — clean hierarchy, consistent touch targets */
export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  destructive,
  accessibilityLabel,
}: SettingsRowProps) {
  const { text, textSecondary, hex } = useThemeColors();
  const textColor = destructive ? '#EF4444' : hex.text;
  const subColor = destructive ? 'rgba(239,68,68,0.8)' : hex.textSecondary;

  const content = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text
        style={{
          fontSize: TYPOGRAPHY.cardTitle.fontSize,
          fontWeight: '600',
          color: textColor,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontSize: TYPOGRAPHY.caption.fontSize,
            color: subColor,
            marginTop: 2,
            lineHeight: 18,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  const row = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        gap: 12,
      }}
    >
      {icon ? (
        <View style={{ width: 24, alignItems: 'center' }}>{icon}</View>
      ) : null}
      {content}
      {rightElement ?? null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={0.7}
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityRole="button"
      >
        {row}
      </TouchableOpacity>
    );
  }

  return row;
}
