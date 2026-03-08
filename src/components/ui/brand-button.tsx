import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, GestureResponderEvent, ViewStyle } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { BRAND } from '@/constants/colors';

type BrandButtonProps = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  className?: string;
  style?: ViewStyle;
};

export function BrandButton({
  label,
  onPress,
  loading,
  disabled,
  fullWidth,
  variant = 'primary',
  className,
  style,
}: BrandButtonProps) {
  const { textOnPrimary, elevated } = useThemeColors();
  const isDisabled = disabled || loading;

  const variantStyles =
    variant === 'secondary'
      ? `${elevated} border border-gray-400 dark:border-gray-500`
      : variant === 'destructive'
        ? 'bg-red-500 active:bg-red-600'
        : 'bg-primary active:bg-primary-dark';

  const textStyles =
    variant === 'secondary'
      ? 'text-primary font-semibold'
      : variant === 'destructive'
        ? 'text-white font-semibold'
        : textOnPrimary;

  const spinnerColor = variant === 'secondary' ? BRAND.primary : '#ffffff';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      disabled={isDisabled}
      className={`${fullWidth ? 'w-full' : ''} rounded-xl items-center justify-center ${variantStyles} ${isDisabled ? 'opacity-70' : ''} ${className ?? ''}`}
      style={[
        {
          minHeight: 48,
          paddingHorizontal: 20,
          ...(variant === 'primary' && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 3,
          }),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <Text className={`${textStyles} text-base font-semibold`}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export default BrandButton;

