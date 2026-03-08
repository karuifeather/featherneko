import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faExclamationCircle, faRedo } from '@fortawesome/free-solid-svg-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ACCENT, SEMANTIC } from '@/constants/colors';
import { RADIUS, TYPOGRAPHY } from '@/constants/designTokens';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorMessage({
  message,
  onRetry,
  className = '',
}: ErrorMessageProps) {
  const { hex } = useThemeColors();
  return (
    <View
      style={{
        backgroundColor: hex.surface,
        borderRadius: RADIUS.card,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.2)',
      }}
      className={className}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <FontAwesomeIcon
          icon={faExclamationCircle}
          size={20}
          color={SEMANTIC.destructive}
          style={{ marginRight: 12 }}
        />
        <Text
          style={{
            flex: 1,
            fontSize: TYPOGRAPHY.body.fontSize,
            color: hex.textSecondary,
          }}
          numberOfLines={3}
        >
          {message}
        </Text>
      </View>
      {onRetry && (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRetry();
          }}
          style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center' }}
          accessibilityLabel="Try again"
          accessibilityRole="button"
        >
          <FontAwesomeIcon icon={faRedo} size={14} color={ACCENT.primary} />
          <Text
            style={{
              marginLeft: 8,
              fontSize: 14,
              fontWeight: '600',
              color: ACCENT.primary,
            }}
          >
            Try again
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
