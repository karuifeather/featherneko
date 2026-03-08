import React from 'react';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import AnimeRow from './row';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { useThemeColors } from '@/hooks/useThemeColors';
import { TYPOGRAPHY, RADIUS } from '@/constants/designTokens';

interface Anime {
  id: number;
  idMal: number;
  title: { romaji: string; english: string };
  coverImage: { large: string };
  bannerImage: string;
}

const AnimeRowForAnime: React.FC<{ data: Anime[]; title: string }> = ({
  data,
  title,
}) => {
  const router = useRouter();
  const { text, textSecondary } = useThemeColors();

  return (
    <AnimeRow
      title={title}
      data={data}
      renderItem={(anime) => {
        const animeTitle = anime.title.english || anime.title.romaji || 'Unknown Title';
        return (
          <TouchableOpacity
            key={`${anime.idMal}`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/(root)/anime/details/${anime.idMal}`);
            }}
            activeOpacity={0.9}
            style={{ width: 120 }}
            accessibilityLabel={`${animeTitle}. Double tap to open.`}
            accessibilityRole="button"
          >
            <ImageWithFallback
              source={{ uri: anime.coverImage.large }}
              style={{
                width: 120,
                height: 180,
                borderRadius: RADIUS.poster,
              }}
              resizeMode="cover"
              fadeInDuration={250}
            />
            <Text
              className={text}
              style={{
                fontSize: TYPOGRAPHY.cardTitle.fontSize,
                fontWeight: TYPOGRAPHY.cardTitle.fontWeight,
                marginTop: 8,
                lineHeight: 20,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {animeTitle}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
};

export default AnimeRowForAnime;
