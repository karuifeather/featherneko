import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
} from 'react-native';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { postJsonWithSourceHealth, fetchWithStaleFallback } from '@/cache/fetchWithSourceHealth';
import { useSelectedAnime } from '@/context/anime-provider';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { ACCENT } from '@/constants/colors';
import { RADIUS, TYPOGRAPHY } from '@/constants/designTokens';
import { get, set } from '@/cache';

export interface MediaRecommendation {
  mediaRecommendation: {
    idMal: number;
    title: {
      english: string | null;
      romaji: string | null;
    };
    coverImage: {
      large: string;
    };
  };
}

const query = `
  query ($mal_id: Int, $recommendationsPerPage: Int) {
    Page {
      media(idMal_in: [$mal_id], isAdult: false) {
        recommendations(perPage: $recommendationsPerPage) {
          nodes {
            mediaRecommendation {
              idMal
              title {
                english
                romaji
              }
              coverImage {
                large
              }
            }
          }
        }
      }
    }
  }
`;

interface ScrollProps {
  onScroll: unknown;
  scrollEventThrottle: number;
}

const RecommendedAnimeGrid: React.FC<{ scrollProps?: ScrollProps }> = ({ scrollProps }) => {
  const { bg, text, subtext } = useThemeColors();
  const [data, setData] = React.useState<MediaRecommendation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const router = useRouter();
  const { selectedAnime } = useSelectedAnime();

  useEffect(() => {
    if (!selectedAnime?.idMal) return;

    const loadRecommendations = async () => {
      setLoading(true);
      const cacheKey = String(selectedAnime.idMal);
      const cached = await get('ANILIST_RECOMMENDATIONS', cacheKey);
      if (cached && Array.isArray(cached)) {
        setData(cached as MediaRecommendation[]);
        setErrorMessage(null);
        setLoading(false);
        return;
      }

      const endpoint = 'https://graphql.anilist.co';
      const variables = {
        mal_id: selectedAnime.idMal,
        recommendationsPerPage: 30,
      };

      try {
        const response = await fetchWithStaleFallback(
          async () => {
            const c = await get('ANILIST_RECOMMENDATIONS', cacheKey);
            return Array.isArray(c) ? (c as MediaRecommendation[]) : null;
          },
          async () => {
            const response = await postJsonWithSourceHealth(
              endpoint,
              { query, variables },
              { source: 'anilist' }
            );
            const nodes =
              response?.data?.data?.Page?.media
              ?.filter((media: any) => media?.recommendations?.nodes?.length > 0)
              ?.flatMap((media: any) => media.recommendations.nodes) ?? [];
            const filtered = nodes.filter((n: any) => n?.mediaRecommendation?.idMal != null);
            await set('ANILIST_RECOMMENDATIONS', cacheKey, filtered);
            return filtered;
          },
          { source: 'anilist', allowStaleOnError: true, namespace: 'ANILIST_RECOMMENDATIONS' }
        );
        setData(response ?? []);
        setErrorMessage(null);
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 429) {
          if (__DEV__) console.warn('AniList rate limited (429); skipping recommendations.');
          setErrorMessage('Recommendations are temporarily unavailable. Please try again in a bit.');
        } else {
          if (__DEV__) console.error('Error fetching recommendations:', error);
          setErrorMessage('Failed to load recommendations. Pull to refresh or try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    setData([]);
    loadRecommendations();
  }, [selectedAnime?.idMal]);

  const CARD_WIDTH = 100;
  const CARD_IMAGE_HEIGHT = 140;
  const CARD_MARGIN_BOTTOM = 12;

  const renderAnime = (item: MediaRecommendation) => {
    const rec = item?.mediaRecommendation;
    if (!rec?.idMal) return null;
    const title = rec.title?.english || rec.title?.romaji || 'Unknown Title';
    return (
      <TouchableOpacity
        key={rec.idMal}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/(root)/anime/details/${rec.idMal}`);
        }}
        activeOpacity={0.85}
        style={{ width: CARD_WIDTH, marginBottom: CARD_MARGIN_BOTTOM }}
        accessibilityLabel={`${title}. Double tap to open.`}
        accessibilityRole="button"
      >
        <ImageWithFallback
          source={{ uri: rec.coverImage?.large ?? '' }}
          style={{
            width: CARD_WIDTH,
            height: CARD_IMAGE_HEIGHT,
            borderRadius: RADIUS.poster,
          }}
          resizeMode="cover"
          fadeInDuration={250}
        />
        <Text
          className={`${text} text-sm font-semibold mt-1.5`}
          numberOfLines={2}
          ellipsizeMode="tail"
          style={{ width: CARD_WIDTH }}
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  const ListComp = FlatList;

  return (
    <View className={`flex-1 px-4 py-4 ${bg}`} style={{ minHeight: 0 }}>
      {loading ? (
        <>
          <ActivityIndicator size="large" color={ACCENT.primary} />
          <Text className={`${subtext} text-center`} style={{ marginTop: 8 }}>Loading…</Text>
        </>
      ) : errorMessage ? (
        <View className="py-8 px-4">
          <Text className={`${subtext} text-center`}>{errorMessage}</Text>
        </View>
      ) : (
        <ListComp
          data={data}
          keyExtractor={(item, index) =>
            String(item?.mediaRecommendation?.idMal ?? index)
          }
          renderItem={({ item }) => renderAnime(item)}
          numColumns={3}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ paddingBottom: 24 }}
          style={{ flex: 1 }}
          onScroll={scrollProps?.onScroll}
          scrollEventThrottle={scrollProps?.scrollEventThrottle ?? 16}
          ListHeaderComponent={
            <Text className={`text-lg ${text} font-bold mb-3`}>
              Recommendations
            </Text>
          }
        />
      )}
    </View>
  );
};

export default RecommendedAnimeGrid;
