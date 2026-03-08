import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ACCENT } from '@/constants/colors';
import { TYPOGRAPHY, RADIUS } from '@/constants/designTokens';

interface PremiumTabNavProps {
  tabs: string[];
  activeTab: string;
  onTabPress: (tab: string) => void;
}

/** Premium tab navigation — subtle, intentional */
export function PremiumTabNav({
  tabs,
  activeTab,
  onTabPress,
}: PremiumTabNavProps) {
  const { surface, text, textSecondary, hex } = useThemeColors();

  return (
    <View
      style={{
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: hex.surface,
        borderBottomWidth: 1,
        borderBottomColor: hex.border,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onTabPress(tab);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: RADIUS.button,
                backgroundColor: isActive ? ACCENT.primary : 'rgba(255,255,255,0.06)',
                minHeight: 36,
                justifyContent: 'center',
              }}
              accessibilityLabel={`${tab} tab`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={{
                  fontSize: TYPOGRAPHY.pillLabel.fontSize,
                  fontWeight: TYPOGRAPHY.pillLabel.fontWeight,
                  color: isActive ? ACCENT.primaryForeground : hex.textSecondary,
                }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
