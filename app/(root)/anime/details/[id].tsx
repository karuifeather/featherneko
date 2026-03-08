import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import * as Haptics from 'expo-haptics';

import AnimeRecommendation from '@/components/recom-grid';
import EpisodesList from '@/components/episodes-list';
import { useSelectedAnime } from '@/context/anime-provider';
import AnimeDetails from '@/components/anime-details';
import ReviewsComponent from '@/components/review';
import CharacterList from '@/components/character-list';
import { PremiumTabNav } from '@/components/ui/premium-tab-nav';
import { CollapsibleHero } from '@/components/collapsible-hero';
import { addToWatchlist, removeFromWatchlist } from '@/state/watchlistSlice';
import { selectWatchlistMalIds } from '@/state/selectors';
import { useThemeColors } from '@/hooks/useThemeColors';
import { BrandButton } from '@/components/ui/brand-button';
import { ACCENT } from '@/constants/colors';
import { getAnimeMedia, setAnimeMedia } from '@/cache';
import { postJsonWithSourceHealth, fetchWithStaleFallback } from '@/cache/fetchWithSourceHealth';

const query = `
  query ($mal_id: Int) {
    Page {
      media(idMal_in: [$mal_id], type: ANIME) {
        id
        idMal
        title { english romaji }
        genres
        bannerImage
        coverImage { large }
        status
        format
        episodes
        description
        rankings { rank context allTime year season }
        meanScore
        favourites
        popularity
        averageScore
        stats { statusDistribution { amount status } }
        startDate { day month year }
        endDate { day month year }
        nextAiringEpisode { episode airingAt timeUntilAiring }
        reviews { pageInfo { total } }
        recommendations { pageInfo { total } }
      }
    }
  }
`;

export default function AnimeDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { bg, text, textSecondary, isDark } = useThemeColors();
  const watchlistIds = useSelector(selectWatchlistMalIds);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState<number | null>(null);
  const { selectedAnime, setSelectedAnime } = useSelectedAnime();
  const [selectedTab, setSelectedTab] = useState<
    'Details' | 'Episodes' | 'Characters' | 'Recommendations' | 'Reviews'
  >('Details');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isCollapsedRef = useRef(false);
  const cooldownRef = useRef(false);
  const expandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTabPress = useCallback((tab: string) => {
    setSelectedTab(tab as 'Details' | 'Episodes' | 'Characters' | 'Recommendations' | 'Reviews');
    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
    if (isCollapsedRef.current) {
      isCollapsedRef.current = false;
      cooldownRef.current = true;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsCollapsed(false);
      setTimeout(() => { cooldownRef.current = false; }, 350);
    }
  }, []);

  const fetchAnimeByMalId = async (mal_id: number) => {
    setError(null);
    try {
      const cached = await getAnimeMedia(mal_id);
      if (cached && typeof cached === 'object' && (cached as { idMal?: number }).idMal != null) {
        setSelectedAnime(cached as never);
        setLoading(false);
        const hasFullMeta =
          (cached as { reviews?: { pageInfo?: { total?: number } }; recommendations?: { pageInfo?: { total?: number } } })
            ?.reviews?.pageInfo?.total != null &&
          (cached as { recommendations?: { pageInfo?: { total?: number } } })
            ?.recommendations?.pageInfo?.total != null;
        if (hasFullMeta) return;
      }

      const fetchFresh = async () => {
        const endpoint = 'https://graphql.anilist.co';
        const response = await postJsonWithSourceHealth(
          endpoint,
          { query, variables: { mal_id } },
          { source: 'anilist' }
        );
        const animeData = (response as { data?: { data?: { Page?: { media?: unknown[] } } } })?.data?.data?.Page?.media;
        if (!animeData?.[0]) throw new Error('No anime data');
        await setAnimeMedia(mal_id, animeData[0] as never);
        return animeData[0];
      };

      const media = await fetchWithStaleFallback(
        () => getAnimeMedia(mal_id),
        fetchFresh,
        { source: 'anilist', allowStaleOnError: true, namespace: 'ANIME_MEDIA_STABLE' }
      );

      if (media) setSelectedAnime(media as never);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (__DEV__) console.warn('Anime data failed:', status ?? (err as Error)?.message);
      if (status === 429) {
        setRateLimited(true);
        setCooldownSecondsLeft(60);
        const intervalId = setInterval(() => {
          setCooldownSecondsLeft((s) => {
            if (s == null || s <= 1) {
              clearInterval(intervalId);
              setRateLimited(false);
              setCooldownSecondsLeft(null);
              fetchAnimeByMalId(mal_id);
              return null;
            }
            return s - 1;
          });
        }, 1000);
        return;
      }
      setError('Failed to load anime. Pull to retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnimeByMalId(Number(id));
  }, [id]);

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (expandTimeoutRef.current) clearTimeout(expandTimeoutRef.current);
    };
  }, []);

  const COLLAPSE_THRESHOLD = 120;
  const EXPAND_THRESHOLD = 30;
  const EXPAND_DEBOUNCE_MS = 180;

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = e.nativeEvent.contentOffset.y;

      if (y >= EXPAND_THRESHOLD) {
        if (expandTimeoutRef.current) {
          clearTimeout(expandTimeoutRef.current);
          expandTimeoutRef.current = null;
        }
      }

      if (cooldownRef.current) return;

      if (y > COLLAPSE_THRESHOLD && !isCollapsedRef.current) {
        if (expandTimeoutRef.current) {
          clearTimeout(expandTimeoutRef.current);
          expandTimeoutRef.current = null;
        }
        isCollapsedRef.current = true;
        cooldownRef.current = true;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsCollapsed(true);
        setTimeout(() => { cooldownRef.current = false; }, 350);
      } else if (y < EXPAND_THRESHOLD && isCollapsedRef.current) {
        if (expandTimeoutRef.current) return;
        expandTimeoutRef.current = setTimeout(() => {
          expandTimeoutRef.current = null;
          if (cooldownRef.current) return;
          if (!isCollapsedRef.current) return;
          isCollapsedRef.current = false;
          cooldownRef.current = true;
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsCollapsed(false);
          setTimeout(() => { cooldownRef.current = false; }, 350);
        }, EXPAND_DEBOUNCE_MS);
      }
    },
    [],
  );

  const scrollProps = useMemo(() => ({
    onScroll: handleScroll,
    scrollEventThrottle: 16,
  }), [handleScroll]);

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'Details':
        return <AnimeDetails scrollProps={scrollProps} />;
      case 'Episodes':
        return <EpisodesList scrollProps={scrollProps} />;
      case 'Characters':
        return <CharacterList scrollProps={scrollProps} />;
      case 'Recommendations':
        return <AnimeRecommendation scrollProps={scrollProps} />;
      case 'Reviews':
        return <ReviewsComponent mal_id={selectedAnime?.idMal as number} scrollProps={scrollProps} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View className={`flex-1 justify-center items-center ${bg}`}>
        <ActivityIndicator size="large" color={ACCENT.primary} />
        <Text className={`${textSecondary} mt-4`} style={{ fontSize: 15 }}>Loading…</Text>
      </View>
    );
  }

  if (rateLimited) {
    return (
      <View className={`flex-1 justify-center items-center px-6 ${bg}`}>
        <Text className={`${text} text-center`} style={{ fontSize: 15 }}>Rate limited. Retrying in ~{cooldownSecondsLeft ?? 0}s…</Text>
        <ActivityIndicator size="small" color={ACCENT.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 justify-center items-center px-6 ${bg}`}>
        <Text className={`${textSecondary} text-center`} style={{ fontSize: 15 }}>{error}</Text>
        <BrandButton
          label="Retry"
          onPress={() => {
            setLoading(true);
            fetchAnimeByMalId(Number(id));
          }}
          className="mt-4"
        />
      </View>
    );
  }

  const animeCover = (selectedAnime as { coverImage?: { large?: string } | string })?.coverImage;
  const heroUri =
    (selectedAnime as { bannerImage?: string })?.bannerImage ||
    (typeof animeCover === 'object' ? animeCover?.large ?? null : null) ||
    (typeof animeCover === 'string' ? animeCover : null);

  const title = (selectedAnime as { title?: { english?: string; romaji?: string } })?.title?.english ||
    (selectedAnime as { title?: { romaji?: string } })?.title?.romaji ||
    'Untitled';
  const anime = selectedAnime as {
    idMal?: number;
    id?: number;
    genres?: string[];
    coverImage?: { large?: string };
    title?: { english?: string; romaji?: string };
    episodes?: number;
    status?: string;
    averageScore?: number;
  };
  const inWatchlist = watchlistIds.includes(anime?.idMal ?? 0);

  const buildTabs = () => {
    const tabs: string[] = ['Details'];
    if (
      (anime?.episodes != null && anime.episodes > 0) ||
      anime?.status === 'RELEASING' ||
      anime?.status === 'FINISHED' ||
      anime?.status === 'HIATUS'
    ) {
      tabs.push('Episodes');
    }
    if ((selectedAnime as { reviews?: { pageInfo?: { total?: number } } })?.reviews?.pageInfo?.total) {
      tabs.push('Reviews');
    }
    tabs.push('Characters');
    if ((selectedAnime as { recommendations?: { pageInfo?: { total?: number } } })?.recommendations?.pageInfo?.total) {
      tabs.push('Recommendations');
    }
    return tabs;
  };

  const coverImageUri =
    typeof anime?.coverImage === 'object' && anime?.coverImage?.large
      ? anime.coverImage.large
      : null;

  return (
    <View className={`flex-1 ${bg}`}>
      {selectedAnime && (
        <CollapsibleHero
          isCollapsed={isCollapsed}
            heroUri={heroUri}
            title={title}
            averageScore={anime?.averageScore}
            episodes={anime?.episodes}
            status={anime?.status}
            genres={anime?.genres ?? []}
            inWatchlist={inWatchlist}
            onBack={() => router.back()}
            onWatchPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedTab('Episodes');
            }}
            onWatchlistPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const malId = anime?.idMal;
              if (!malId) return;
              if (inWatchlist) {
                dispatch(removeFromWatchlist(malId));
              } else {
                dispatch(
                  addToWatchlist({
                    malId,
                    anilistId: anime?.id ?? 0,
                    title: anime?.title?.english || anime?.title?.romaji || 'Unknown',
                    coverImage: anime?.coverImage?.large ?? '',
                    addedAt: Date.now(),
                  })
                );
              }
            }}
            coverImageUri={coverImageUri}
            isDark={isDark}
            insets={insets}
          />
        )}

        <PremiumTabNav
          tabs={buildTabs()}
          activeTab={selectedTab}
          onTabPress={handleTabPress}
        />

        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          {renderTabContent()}
        </View>
      </View>
  );
}

