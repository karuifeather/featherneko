import React from 'react';
import { View, Text } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { TYPOGRAPHY } from '@/constants/designTokens';

interface MetadataRowProps {
  label: string;
  value: string | number;
  hideBorder?: boolean;
  /** Use for tighter layouts (e.g. info card) */
  compact?: boolean;
}

/** Compact metadata row for score, episodes, status, etc. */
export function MetadataRow({ label, value, hideBorder, compact }: MetadataRowProps) {
  const { hex } = useThemeColors();
  const py = compact ? 5 : 8;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: py,
        borderBottomWidth: hideBorder ? 0 : 1,
        borderBottomColor: hex.border,
      }}
    >
      <Text
        style={{
          fontSize: compact ? TYPOGRAPHY.caption.fontSize : TYPOGRAPHY.metadata.fontSize,
          fontWeight: TYPOGRAPHY.metadata.fontWeight,
          color: hex.textSecondary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: compact ? TYPOGRAPHY.caption.fontSize : TYPOGRAPHY.metadata.fontSize,
          fontWeight: '600',
          color: hex.text,
        }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
    </View>
  );
}

/** Compact inline metadata chips (e.g. "TV · 12 eps · 2024") */
export function MetadataChips({ items }: { items: (string | number)[] }) {
  const { hex } = useThemeColors();
  const filtered = items.filter((x) => x != null && x !== '');

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {filtered.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          {i > 0 && (
            <Text
              style={{
                fontSize: TYPOGRAPHY.caption.fontSize,
                color: hex.textTertiary,
                marginHorizontal: 4,
              }}
            >
              ·
            </Text>
          )}
          <Text
            style={{
              fontSize: TYPOGRAPHY.caption.fontSize,
              color: hex.textSecondary,
            }}
          >
            {typeof item === 'number' ? item : String(item)}
          </Text>
        </View>
      ))}
    </View>
  );
}
