import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

type LinkButtonProps = {
  label: string;
  onPress: () => void;
  ariaLabel?: string;
};

/** Premium "See all" / "See history" — quiet, clean */
export function LinkButton({ label, onPress, ariaLabel }: LinkButtonProps) {
  const { textSecondary } = useThemeColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
      accessibilityLabel={ariaLabel ?? label}
      accessibilityRole="button"
    >
      <Text
        className={textSecondary}
        style={{
          fontSize: 13,
          fontWeight: '600',
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
