import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { postJsonWithSourceHealth, fetchWithStaleFallback } from '@/cache/fetchWithSourceHealth';
import { useSelector } from 'react-redux';

import getSeasonsDynamic from '@/utils/getSeasonsDynamic';
import AnimeRow from '@/components/anime-row';
import CarouselHeroSection from '@/components/carasoul-hero';
import ContinueWatchingRow from '@/components/continue-watching-row';
import ErrorMessage from '@/components/error-message';
import { HeroSkeleton, ShelfRowSkeleton } from '@/components/ui/skeleton';
import { EdgeToEdgeScreen } from '@/components/screen-container';
import { OverlayHeader } from '@/components/overlay-header';
import { useEdgeToEdgeInsets } from '@/hooks/useEdgeToEdgeInsets';
import { useThemeColors } from '@/hooks/useThemeColors';
import { RootState } from '@/state/store';
import { get, set, setAnimeMedia, HOME_FEED_TTL_MS } from '@/cache';
import { ACCENT } from '@/constants/colors';

const query = `query (
  $season: MediaSeason
  $seasonYear: Int
  $nextSeason: MediaSeason
  $nextYear: Int
) {
  trending: Page(page: 1, perPage: 6) {
    media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
      ...media
    }
  }
  season: Page(page: 1, perPage: 6) {
    media(
      season: $season
      seasonYear: $seasonYear
      sort: POPULARITY_DESC
      type: ANIME
      isAdult: false
    ) {
      ...media
    }
  }
  nextSeason: Page(page: 1, perPage: 6) {
    media(
      season: $nextSeason
      seasonYear: $nextYear
      sort: POPULARITY_DESC
      type: ANIME
      isAdult: false
    ) {
      ...media
    }
  }
  popular: Page(page: 1, perPage: 6) {
    media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
      ...media
    }
  }
  top: Page(page: 1, perPage: 10) {
    media(sort: SCORE_DESC, type: ANIME, isAdult: false) {
      ...media
    }
  }
}

fragment media on Media {
  id
  idMal
  title {
    romaji
    english
  }
  coverImage {
    large
  }
  bannerImage
  description
}
`;

const discoveryQuery = `
  query ($malId: Int) {
    Page {
      media(idMal: $malId, type: ANIME) {
        recommendations(perPage: 10) {
          nodes {
            mediaRecommendation {
              id
              idMal
              title { romaji english }
              coverImage { large }
              bannerImage
              description
            }
          }
        }
      }
    }
  }
`;

type HomeFeedPayload = {
  trending: any[];
  season: any[];
  nextSeason: any[];
  popular: any[];
  top: any[];
};

export default function HomeScreen() {
  const { bg } = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trendingAnime, setTrendingAnime] = useState([]);
  const [seasonAnime, setSeasonAnime] = useState([]);
  const [nextSeasonAnime, setNextSeasonAnime] = useState([]);
  const [popularAnime, setPopularAnime] = useState([]);
  const [topAnime, setTopAnime] = useState([]);
  const [discoveryRecs, setDiscoveryRecs] = useState<any[]>([]);

  const firstContinue = useSelector((state: RootState) => state.continueWatching.entries[0]);
  const firstWatchlist = useSelector((state: RootState) => state.watchlist.items[0]);
  const discoverySourceMalId = firstContinue?.malId ?? firstWatchlist?.malId ?? null;

  const applyFeedData = useCallback((res: { data: any }) => {
    const d = res.data;
    setTrendingAnime(d.trending?.media ?? d.trending ?? []);
    setSeasonAnime(d.season?.media ?? d.season ?? []);
    setNextSeasonAnime(d.nextSeason?.media ?? d.nextSeason ?? []);
    setPopularAnime(d.popular?.media ?? d.popular ?? []);
    setTopAnime(d.top?.media ?? d.top ?? []);
  }, []);

  const fetchAnime = useCallback(async (skipCache = false) => {
    if (!skipCache) {
      const cached = await get('ANILIST_FEED', 'home') as HomeFeedPayload | null;
      if (cached && Array.isArray(cached.trending)) {
        applyFeedData({ data: cached });
        setLoading(false);
        setError(null);
        return;
      }
    }

    setLoading(true);
    setError(null);
    const endpoint = 'https://graphql.anilist.co';
    const variables = getSeasonsDynamic();
    const maxRetries = 3;
    const baseDelayMs = 2000;

    const fetchPayload = async (): Promise<HomeFeedPayload> => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const { data: res } = await postJsonWithSourceHealth(
            endpoint,
            { query, variables },
            { source: 'anilist' }
          );
          return {
            trending: res.data.trending.media,
            season: res.data.season.media,
            nextSeason: res.data.nextSeason.media,
            popular: res.data.popular.media,
            top: res.data.top.media,
          };
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          const isRetryable = status === 429 || (status != null && status >= 500 && status < 600);
          if (attempt < maxRetries && isRetryable) {
            await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
            continue;
          }
          throw err;
        }
      }
      throw new Error('Failed to fetch anime');
    };

    try {
      const payload = await fetchWithStaleFallback(
        () => get('ANILIST_FEED', 'home') as Promise<HomeFeedPayload | null>,
        fetchPayload,
        { source: 'anilist', allowStaleOnError: true, namespace: 'ANILIST_FEED' }
      );

      await set('ANILIST_FEED', 'home', payload, HOME_FEED_TTL_MS);
      for (const list of [payload.trending, payload.season, payload.nextSeason, payload.popular, payload.top]) {
        if (!Array.isArray(list)) continue;
        for (const m of list) {
          const malId = m?.idMal ?? m?.id;
          if (malId != null && typeof m === 'object') await setAnimeMedia(malId, m as Record<string, unknown>);
        }
      }
      setTrendingAnime(payload.trending);
      setSeasonAnime(payload.season);
      setNextSeasonAnime(payload.nextSeason);
      setPopularAnime(payload.popular);
      setTopAnime(payload.top);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (__DEV__) console.warn('Fetch anime failed:', status ?? (err as Error)?.message);
      setError(
        status === 429
          ? 'Too many requests. Please wait a moment and pull to retry.'
          : (err as Error)?.message ?? 'Failed to load anime. Pull to retry.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyFeedData]);

  const refreshFeed = useCallback(() => {
    setRefreshing(true);
    fetchAnime(true);
  }, [fetchAnime]);

  useEffect(() => {
    fetchAnime();
  }, [fetchAnime]);

  useEffect(() => {
    if (!discoverySourceMalId) {
      setDiscoveryRecs([]);
      return;
    }
    let cancelled = false;
    postJsonWithSourceHealth('https://graphql.anilist.co', {
      query: discoveryQuery,
      variables: { malId: discoverySourceMalId },
    }, { source: 'anilist' })
      .then((res: { data?: { data?: { Page?: { media?: unknown[] } } } }) => {
        if (cancelled) return;
        const media = res?.data?.data?.Page?.media?.[0];
        const nodes = media?.recommendations?.nodes ?? [];
        const list = nodes
          .map((n: any) => n?.mediaRecommendation)
          .filter((m: any) => m?.idMal);
        setDiscoveryRecs(list);
      })
      .catch(() => setDiscoveryRecs([]));
    return () => { cancelled = true; };
  }, [discoverySourceMalId]);

  const { tabBarHeight } = useEdgeToEdgeInsets();

  const content = loading && !error ? (
    <ScrollView
      className={bg}
      contentContainerStyle={{ paddingTop: 0, paddingBottom: tabBarHeight + 32 }}
    >
      <View>
        <HeroSkeleton />
      </View>
      <ShelfRowSkeleton count={5} />
      <ShelfRowSkeleton count={5} />
      <ShelfRowSkeleton count={5} />
    </ScrollView>
  ) : error && !seasonAnime.length ? (
    <View className={`flex-1 justify-center p-4 ${bg}`}>
      <ErrorMessage message={error} onRetry={refreshFeed} />
    </View>
  ) : (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshFeed}
          colors={[ACCENT.primary]}
          tintColor={ACCENT.primary}
        />
      }
      contentContainerStyle={{ paddingTop: 0, paddingBottom: tabBarHeight + 24 }}
      className={bg}
    >
      <View>
        {error ? (
          <View className="px-4 pt-3 pb-1">
            <ErrorMessage message={error} onRetry={refreshFeed} />
          </View>
        ) : null}
        <CarouselHeroSection
          trendingAnime={
            discoveryRecs.length > 0 ? discoveryRecs : nextSeasonAnime
          }
        />
        <ContinueWatchingRow />
        <AnimeRow title="Trending" data={trendingAnime} />
        <AnimeRow title="This Season" data={seasonAnime} />
        <AnimeRow title="Upcoming" data={nextSeasonAnime} />
        <AnimeRow title="Popular" data={popularAnime} />
        <AnimeRow title="Top" data={topAnime} />
      </View>
    </ScrollView>
  );

  return (
    <EdgeToEdgeScreen
      style={{ flex: 1 }}
      overlay={<OverlayHeader />}
      topScrim
    >
      {content}
    </EdgeToEdgeScreen>
  );
}
