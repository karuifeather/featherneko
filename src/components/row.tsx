import { useRouter } from 'expo-router';
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { LinkButton } from '@/components/ui/link-button';
import { TYPOGRAPHY } from '@/constants/designTokens';

type RowProps<T> = {
  title: string;
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
};

const Row = <T,>({ title, data, renderItem }: RowProps<T>) => {
  const router = useRouter();
  const { text, textSecondary } = useThemeColors();
  const list = Array.isArray(data) ? data : [];

  if (list.length === 0) return null;

  return (
    <View style={{ marginBottom: 28 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          marginBottom: 12,
        }}
      >
        <Text
          className={text}
          style={{
            fontSize: TYPOGRAPHY.sectionTitle.fontSize,
            fontWeight: TYPOGRAPHY.sectionTitle.fontWeight,
            lineHeight: TYPOGRAPHY.sectionTitle.lineHeight,
          }}
        >
          {title}
        </Text>
        <LinkButton
          label="See all"
          onPress={() => {
            const slug = title.split(' ').join('-').toLowerCase();
            router.push(`/(root)/anime/${slug}` as never);
          }}
          ariaLabel={`See all ${title}`}
        />
      </View>
      <ScrollView
        horizontal
        style={{ marginHorizontal: 16 }}
        contentContainerStyle={{ gap: 14 }}
        showsHorizontalScrollIndicator={false}
      >
        {list.map((item, index) => renderItem(item, index))}
      </ScrollView>
    </View>
  );
};

export default Row;
