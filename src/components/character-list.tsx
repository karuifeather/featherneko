import { useSelectedAnime } from '@/context/anime-provider';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { RADIUS, TYPOGRAPHY } from '@/constants/designTokens';
import { get, set } from '@/cache';
import { postJsonWithSourceHealth, fetchWithStaleFallback } from '@/cache/fetchWithSourceHealth';
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';

interface Character {
  node: {
    name: {
      full: string;
    };
    image: {
      large: string;
    };
  };
  role: string;
}

interface ScrollProps {
  onScroll: unknown;
  scrollEventThrottle: number;
}

const CharacterList: React.FC<{ scrollProps?: ScrollProps }> = ({ scrollProps }) => {
  const { selectedAnime } = useSelectedAnime();
  const { bg, text, textSecondary, hex } = useThemeColors();
  const [characters, setCharacters] = React.useState<Character[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadCharacters = async () => {
      if (!selectedAnime?.id) return;
      const malId = selectedAnime?.idMal;
      const cacheKey = malId != null ? String(malId) : null;

      if (cacheKey) {
        const cached = await get('ANILIST_CHARACTERS', cacheKey);
        if (cached && Array.isArray(cached)) {
          setCharacters(cached as Character[]);
          setErrorMessage(null);
          return;
        }
      }

      const query = `
        query ($anilist_id: Int, $sort: [CharacterSort]) {
          Media(id: $anilist_id, type: ANIME) {
            characters(sort: $sort) {
              edges {
                node {
                  name {
                    full
                  }
                  image {
                    large
                  }
                }
                role
              }
            }
          }
        }
      `;

      const variables = { anilist_id: selectedAnime.id, sort: ['ROLE'] };

      try {
        const edges = await fetchWithStaleFallback(
          async () => {
            const c = await get('ANILIST_CHARACTERS', cacheKey);
            return Array.isArray(c) ? (c as Character[]) : null;
          },
          async () => {
            const { data: res } = await postJsonWithSourceHealth(
              'https://graphql.anilist.co',
              { query, variables },
              { source: 'anilist' }
            );
            const body = res as { data?: { Media?: { characters?: { edges?: unknown[] } } } };
            const edges = body?.data?.Media?.characters?.edges ?? [];
            if (cacheKey && edges.length > 0) await set('ANILIST_CHARACTERS', cacheKey, edges);
            return edges;
          },
          { source: 'anilist', allowStaleOnError: true, namespace: 'ANILIST_CHARACTERS' }
        );
        setCharacters(edges ?? []);
        setErrorMessage(null);
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 429) {
          if (__DEV__) console.warn('AniList rate limited (429); skipping characters.');
          setErrorMessage('Characters are temporarily unavailable. Please try again in a bit.');
        } else {
          if (__DEV__) console.error('Failed to fetch characters:', error);
          setErrorMessage('Failed to load characters. Pull to refresh or try again later.');
        }
      }
    };

    loadCharacters();
  }, [selectedAnime?.id, selectedAnime?.idMal]);

  const renderCharacter = ({ item }: { item: Character }) => (
    <View
      style={{
        backgroundColor: hex.surface,
        borderRadius: RADIUS.card,
        overflow: 'hidden',
        marginBottom: 16,
        width: '48%',
      }}
    >
      <ImageWithFallback
        source={{ uri: item.node.image?.large ?? '' }}
        style={{ width: '100%', height: 160 }}
        resizeMode="cover"
        fadeInDuration={250}
      />
      <View style={{ padding: 10 }}>
        <Text
          style={{ fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: '600', color: hex.text, textAlign: 'center' }}
          numberOfLines={1}
        >
          {item.node.name.full}
        </Text>
        <Text style={{ fontSize: 12, color: hex.textSecondary, textAlign: 'center', marginTop: 4 }}>
          {item.role}
        </Text>
      </View>
    </View>
  );

  return (
    <View className={`flex-1 ${bg} p-4`}>
      <Text className={`${text} text-xl font-bold mb-4`}>Characters</Text>
      <FlatList
        data={characters}
        renderItem={renderCharacter}
        keyExtractor={(item, index) => `${item.node.name.full}-${index}`}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollProps?.onScroll}
        scrollEventThrottle={scrollProps?.scrollEventThrottle ?? 16}
        ListEmptyComponent={
          errorMessage ? (
            <View className="py-6">
              <Text className={`${text} text-sm text-center`}>{errorMessage}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

export default CharacterList;
