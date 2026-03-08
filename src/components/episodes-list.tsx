import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useEpisodeContext } from '@/context/episode-provider';
import { useSelectedAnime } from '@/context/anime-provider';
import { useSelector } from 'react-redux';
import { fetchWithSourceHealth, fetchWithStaleFallback } from '@/cache/fetchWithSourceHealth';
import { getEpisodePageCacheContext } from '@/cache/utils/frontierPage';
import { Episode, EpisodesResponse } from '@/types';
import { selectWatchedEpisodeIdsForAnime } from '@/state/selectors';
import { RootState } from '@/state/store';
import {
  getLocalEpisodes,
  mergeLocalEpisode,
  getLocalAnime,
  getEpisodeRepairState,
  setEpisodeRepairState,
} from '@/utils/localDb';
import { buildPageFromEntities } from '@/cache/utils/episodeEntityToPage';
import { resolveKitsuAnimeId } from '@/utils/kitsuResolver';
import {
  classifyEpisodeCache,
  shouldTrustCache,
  getRepairDecision,
  type EpisodeRepairState,
} from '@/utils/episodeCacheValidation';
import { get, set } from '@/cache';
import { recordCacheMetric } from '@/cache/metrics';

import { EpisodeRow, EpisodeRangeNav, EpisodeListSkeleton } from '@/components/episodes';
import { useThemeColors } from '@/hooks/useThemeColors';
import { TYPOGRAPHY, SPACING } from '@/constants/designTokens';

const NOMINAL_EPISODE_DURATION_SEC = 24 * 60; // 24 min for progress ratio

interface ScrollProps {
  onScroll: unknown;
  scrollEventThrottle: number;
}

export type EpisodesListVariant = 'details' | 'watch';

interface EpisodesListProps {
  scrollProps?: ScrollProps;
  /** 'details' = tap navigates to watch screen; 'watch' = tap only switches episode (already on watch screen) */
  variant?: EpisodesListVariant;
}

const EpisodeList = ({ scrollProps, variant = 'details' }: EpisodesListProps) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [totalTabs, setTotalTabs] = useState(1);
  const [totalEpisodesCount, setTotalEpisodesCount] = useState(0);
  const [currentTab, setCurrentTab] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  const { setSelectedEpisode, selectedEpisode } = useEpisodeContext();
  const { selectedAnime } = useSelectedAnime();
  const { hex } = useThemeColors();
  const malId = selectedAnime?.idMal ?? 0;

  const watchedIds = useSelector((state) =>
    selectWatchedEpisodeIdsForAnime(state, String(malId))
  );
  const watchedSet = useMemo(() => new Set(watchedIds), [watchedIds]);

  const progressByKey = useSelector((state: RootState) => state.episodeProgress.byKey);
  const getProgress = useMemo(
    () => (epNum: number) => {
      const key = `${malId}-${epNum}`;
      const s = progressByKey[key];
      return typeof s === 'number' && s > 0 ? s : 0;
    },
    [progressByKey, malId]
  );

  const router = useRouter();
  const episodesPerTab = 10;

  // When in watch screen, start on the page containing the current episode
  useEffect(() => {
    if (variant !== 'watch' || !selectedEpisode?.attributes?.number) return;
    const epNum = selectedEpisode.attributes.number;
    const page = Math.ceil(epNum / episodesPerTab);
    if (page >= 1 && page <= totalTabs) setCurrentTab(page);
  }, [variant, selectedEpisode?.attributes?.number, totalTabs, episodesPerTab]);

  useEffect(() => {
    const loadEpisodes = async (page: number) => {
      if (!selectedAnime?.idMal) return;
      setLoading(true);
      setLoadMessage(null);
      const id = selectedAnime.idMal as number;
      const cacheKey = `${id}_${page}`;

      try {
        const animeMeta = selectedAnime as {
          episodes?: number;
          status?: string;
          format?: string;
          id?: number;
          title?: { english?: string; romaji?: string };
        };
        const expectedEpisodes = animeMeta.episodes ?? null;
        const status = animeMeta.status ?? null;
        const format = animeMeta.format ?? null;

        const [repairState, localAnime, cached, entities] = await Promise.all([
          getEpisodeRepairState(id),
          getLocalAnime(id),
          get('KITSU_EPISODES_PAGE', cacheKey),
          getLocalEpisodes(id),
        ]);

        const kitsuResult = await resolveKitsuAnimeId({
          idMal: id,
          anilistId: animeMeta.id ?? null,
          titleEnglish: animeMeta.title?.english ?? null,
          titleRomaji: animeMeta.title?.romaji ?? null,
          bypassLocalCache: false,
        });

        const cachedKitsuId = localAnime?.kitsuId ?? null;
        const kitsuId = kitsuResult?.kitsuId ?? null;
        const confidence = kitsuResult?.confidence ?? 'low';

        const validateAndMaybeUse = (
          observedCount: number,
          dataSource: 'page_cache' | 'local_entities'
        ) => {
          const result = classifyEpisodeCache({
            expectedEpisodes,
            status,
            format,
            malId: id,
            observedEpisodeCount: observedCount,
            currentPage: page,
            pageSize: episodesPerTab,
            dataSource,
            kitsuId,
            kitsuResolutionConfidence: confidence,
            cachedKitsuId,
            repairState,
          });
          return { result, shouldUse: shouldTrustCache(result) };
        };

        const c = cached && typeof cached === 'object' && 'episodes' in cached
          ? (cached as { episodes: Episode[]; totalEpisodesCount: number; totalTabs: number })
          : null;

        if (c && c.episodes.length > 0) {
          const { result, shouldUse } = validateAndMaybeUse(c.totalEpisodesCount, 'page_cache');
          if (shouldUse) {
            recordCacheMetric('episode_page_validated', {
              namespace: 'KITSU_EPISODES_PAGE',
              classification: result.classification,
            });
            if (result.shouldAcceptSparse) {
              setEpisodeRepairState(id, {
                ...(repairState ?? { malId: id, repairAttemptCount: 0 }),
                malId: id,
                repairAttemptCount: repairState?.repairAttemptCount ?? 0,
                acceptedSparseAt: Date.now(),
                acceptedSparseReason: result.reason,
              }).catch(() => {});
            }
            setEpisodes(c.episodes);
            setTotalEpisodesCount(c.totalEpisodesCount);
            setTotalTabs(c.totalTabs);
            setLoading(false);
            return;
          }
        }

        const entityPage = buildPageFromEntities(entities, page, episodesPerTab);
        if (entityPage && entityPage.episodes.length > 0) {
          const { result, shouldUse } = validateAndMaybeUse(
            entityPage.totalEpisodesCount,
            'local_entities'
          );
          if (shouldUse) {
            recordCacheMetric('episode_page_reconstructed_from_entities', {
              namespace: 'KITSU_EPISODES_PAGE',
              classification: result.classification,
            });
            if (result.shouldAcceptSparse) {
              setEpisodeRepairState(id, {
                ...(repairState ?? { malId: id, repairAttemptCount: 0 }),
                malId: id,
                repairAttemptCount: repairState?.repairAttemptCount ?? 0,
                acceptedSparseAt: Date.now(),
                acceptedSparseReason: result.reason,
              }).catch(() => {});
            }
            setEpisodes(entityPage.episodes);
            setTotalEpisodesCount(entityPage.totalEpisodesCount);
            setTotalTabs(entityPage.totalTabs);
            setLoading(false);
            return;
          }
        }

        const needsRepair =
          (c && c.episodes.length > 0) || (entityPage && entityPage.episodes.length > 0)
            ? validateAndMaybeUse(
                (c ?? entityPage)!.totalEpisodesCount,
                c ? 'page_cache' : 'local_entities'
              ).result.shouldAttemptRepair
            : false;

        const kitsuResultForFetch = needsRepair
          ? await resolveKitsuAnimeId({
              idMal: id,
              anilistId: animeMeta.id ?? null,
              titleEnglish: animeMeta.title?.english ?? null,
              titleRomaji: animeMeta.title?.romaji ?? null,
              bypassLocalCache: true,
            })
          : kitsuResult;

        if (!kitsuResultForFetch) {
          setEpisodes([]);
          setTotalEpisodesCount(0);
          setTotalTabs(1);
          setLoadMessage('Episodes are not available for this series yet.');
          setLoading(false);
          return;
        }

        type PagePayload = {
          episodes: Episode[];
          totalEpisodesCount: number;
          totalTabs: number;
        };
        const getCachedPage = async (): Promise<PagePayload | null> => {
          const c = await get('KITSU_EPISODES_PAGE', cacheKey);
          return c && typeof c === 'object' && 'episodes' in c ? (c as PagePayload) : null;
        };

        const fetchPage = async (): Promise<PagePayload> => {
          const offset = (page - 1) * episodesPerTab;
          const url = `https://kitsu.io/api/edge/episodes?filter[mediaType]=Anime&filter[media_id]=${kitsuResultForFetch.kitsuId}&sort=number&page[limit]=${episodesPerTab}&page[offset]=${offset}`;
          const res = await fetchWithSourceHealth<EpisodesResponse>(url, { source: 'kitsu' });
          const count = res.data.meta?.count ?? 0;
          const totalTabs = Math.ceil(count / episodesPerTab) || 1;
          const data = res.data.data ?? [];

          const payload: PagePayload = {
            episodes: data,
            totalEpisodesCount: count,
            totalTabs,
          };

          const animeStatus = (selectedAnime as { status?: string })?.status;
          const { isFrontier, context: epContext } = getEpisodePageCacheContext(
            id,
            page,
            episodesPerTab,
            count,
            animeStatus
          );
          await set('KITSU_EPISODES_PAGE', cacheKey, payload, undefined, {
            isFrontierPage: isFrontier,
            isCompletedSeries: epContext.animeStatus === 'FINISHED',
            isAiringSeries: epContext.animeStatus === 'RELEASING',
          });

          for (const ep of data) {
            const num = ep?.attributes?.number;
            if (num == null) continue;
            await mergeLocalEpisode(id, num, {
              kitsuId: ep.id,
              thumbnail: ep.attributes?.thumbnail?.original,
              canonicalTitle: ep.attributes?.canonicalTitle,
              synopsis: ep.attributes?.synopsis,
              description: ep.attributes?.description,
              airdate: ep.attributes?.airdate,
              length: ep.attributes?.length,
            });
          }
          return payload;
        };

        const payload = await fetchWithStaleFallback(getCachedPage, fetchPage, {
          source: 'kitsu',
          allowStaleOnError: true,
          namespace: 'KITSU_EPISODES_PAGE',
        });

        if (needsRepair) {
          const sparseResult = validateAndMaybeUse(
            (c ?? entityPage)!.totalEpisodesCount,
            c ? 'page_cache' : 'local_entities'
          ).result;
          const baseState: EpisodeRepairState = repairState ?? {
            malId: id,
            repairAttemptCount: 0,
          };
          const decision = getRepairDecision(sparseResult, baseState);
          if (decision.nextRepairState) {
            setEpisodeRepairState(id, {
              ...baseState,
              ...decision.nextRepairState,
              malId: id,
              lastResolvedKitsuId: kitsuResultForFetch.kitsuId,
              lastObservedEpisodeCount: payload.totalEpisodesCount,
              lastExpectedEpisodeCount: expectedEpisodes ?? undefined,
            }).catch(() => {});
          }
        }

        setEpisodes(payload.episodes);
        setTotalEpisodesCount(payload.totalEpisodesCount);
        setTotalTabs(payload.totalTabs);
      } catch (error) {
        if (__DEV__) {
          const err = error as Error & { response?: { status?: number; data?: unknown } };
          console.error('[Episodes] fetch failed', {
            id,
            message: err?.message,
            status: err?.response?.status,
            stack: err?.stack?.slice(0, 200),
          });
        }
        setLoadMessage('Failed to load episodes. Try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadEpisodes(currentTab);
  }, [currentTab, selectedAnime?.idMal]);

  // When in watch screen, start on the page containing the current episode
  useEffect(() => {
    if (variant === 'watch' && selectedEpisode?.attributes?.number != null && totalTabs > 0) {
      const epNum = selectedEpisode.attributes.number;
      const page = Math.ceil(epNum / episodesPerTab);
      const clamped = Math.max(1, Math.min(page, totalTabs));
      if (clamped !== currentTab) setCurrentTab(clamped);
    }
  }, [variant, selectedEpisode?.attributes?.number, totalTabs, episodesPerTab]);

  const paginationTabs =
    totalEpisodesCount > 0
      ? Array.from({ length: totalTabs }, (_, i) => {
          const start = i * episodesPerTab + 1;
          const end = Math.min((i + 1) * episodesPerTab, totalEpisodesCount);
          return { index: i + 1, label: `${start}–${end}` };
        })
      : [];

  const handlePlay = (episode: Episode) => {
    const num = episode.attributes?.number ?? 0;
    const hasAirdate =
      episode.attributes?.airdate != null && episode.attributes.airdate !== '';
    const isAired =
      !hasAirdate || new Date(episode.attributes!.airdate) <= new Date();
    if (isAired) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedEpisode(episode);
      if (variant === 'details') {
        router.push('/(root)/anime/watch-episode');
      }
    }
  };

  const renderEpisodeRow = ({ item: episode }: { item: Episode }) => {
    const num = episode.attributes?.number ?? 0;
    const hasAirdate =
      episode.attributes?.airdate != null && episode.attributes.airdate !== '';
    const isAired =
      !hasAirdate || new Date(episode.attributes!.airdate) <= new Date();
    const isWatched = watchedSet.has(num);
    const isExpanded = expandedId === episode.id;
    const isCurrent = selectedEpisode?.id === episode.id;

    const progressSec = getProgress(num);
    const progressRatio =
      NOMINAL_EPISODE_DURATION_SEC > 0
        ? Math.min(1, progressSec / NOMINAL_EPISODE_DURATION_SEC)
        : 0;

    const thumbUri =
      episode.attributes?.thumbnail?.original ||
      (selectedAnime?.coverImage as { large?: string })?.large ||
      '';

    return (
      <EpisodeRow
        episode={episode}
        thumbUri={thumbUri}
        isWatched={isWatched}
        progressRatio={progressRatio}
        isAired={isAired}
        isExpanded={isExpanded}
        isCurrent={isCurrent}
        onPress={() => handlePlay(episode)}
        onExpandToggle={() =>
          setExpandedId(isExpanded ? null : episode.id)
        }
        onPlayPress={() => handlePlay(episode)}
      />
    );
  };


  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: SPACING.base,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.xl,
      }}
    >
      {totalEpisodesCount > 0 && paginationTabs.length > 0 && !loading && (
        <EpisodeRangeNav
          totalCount={totalEpisodesCount}
          tabs={paginationTabs}
          activeIndex={currentTab}
          onTabPress={setCurrentTab}
        />
      )}

      {loading ? (
        <View
          style={{
            flex: 1,
            paddingTop: SPACING.xl,
          }}
        >
          <EpisodeListSkeleton />
          <EpisodeListSkeleton />
          <EpisodeListSkeleton />
          <EpisodeListSkeleton />
        </View>
      ) : episodes.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: 40,
          }}
        >
          <Text
            style={{
              fontSize: TYPOGRAPHY.body.fontSize,
              color: hex.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
            }}
          >
            {loadMessage ?? 'Episodes are not available for this series yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={episodes}
          keyExtractor={(item) => item.id}
          renderItem={renderEpisodeRow}
          contentContainerStyle={{ paddingBottom: SPACING.xl }}
          showsVerticalScrollIndicator
          initialNumToRender={16}
          maxToRenderPerBatch={12}
          windowSize={8}
          onScroll={scrollProps?.onScroll}
          scrollEventThrottle={scrollProps?.scrollEventThrottle ?? 16}
        />
      )}
    </View>
  );
};

export default EpisodeList;
