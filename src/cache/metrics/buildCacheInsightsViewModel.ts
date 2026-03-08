/**
 * Build a view model for the Cache Insights UI from metrics snapshot.
 * Computes derived metrics (hit rate, requests avoided, etc.) without double-counting.
 *
 * @see metricSemantics.ts for definitions of readsServedWithoutNetwork,
 *      networkRequestsAvoided, and estimatedSavedMs.
 */

import type {
  CacheMetricsSnapshot,
  CacheMetricsCounters,
  NamespaceMetrics,
  SourceMetrics,
} from './types';
import {
  CONSERVATIVE_MS_PER_AVOIDED,
  MAX_MS_PER_AVOIDED,
} from './metricSemantics';

export interface CacheInsightsViewModel {
  /** Combined session + lifetime for display */
  totalReads: number;
  totalWrites: number;
  cacheHitRate: number;
  readsServedWithoutNetwork: number;
  requestsAvoidedTotal: number;
  estimatedSavedMs: number;

  /** By tier */
  memoryHits: number;
  persistentHits: number;
  entityHits: number;
  cacheMisses: number;
  networkFetches: number;

  /** Resilience */
  requestsAvoidedFresh: number;
  staleServedOnError: number;
  staleServedWhileRateLimited: number;
  duplicateRequestsCollapsed: number;
  entityReconstructions: number;
  negativeCacheHits: number;
  /** Stale fallbacks + served while rate-limited + deferred refreshes */
  recoveredDuringSourceIssues: number;

  /** Time window: 'session' | 'lifetime' */
  timeWindow: 'session' | 'lifetime';

  /** Revalidation */
  backgroundRevalidationsStarted: number;
  backgroundRevalidationsSucceeded: number;
  backgroundRevalidationsFailed: number;

  /** Evictions */
  evictionsTotal: number;

  /** Top namespaces */
  topNamespaces: Array<{
    namespace: string;
    label: string;
    reads: number;
    hits: number;
    avoidedRequests: number;
    usefulnessScore: number;
  }>;

  /** Source resilience */
  sourceMetrics: Array<{
    source: string;
    label: string;
    successes: number;
    failures: number;
    rateLimited: number;
    staleFallbacks: number;
    deferredRefreshes: number;
  }>;

  /** Freshness */
  hasData: boolean;
}

const NAMESPACE_LABELS: Record<string, string> = {
  HOME_FEED: 'Home feed',
  ANILIST_FEED: 'AniList feed',
  ANIME_MEDIA_STABLE: 'Anime details (stable)',
  ANIME_MEDIA_VOLATILE: 'Anime details (volatile)',
  ANILIST_MEDIA: 'AniList media',
  ANILIST_CHARACTERS: 'Characters',
  ANILIST_REVIEWS: 'Reviews',
  ANILIST_RECOMMENDATIONS: 'Recommendations',
  MAL_FORUM_TOPIC: 'MAL forum topic',
  JIKAN_FORUM_LIST: 'Forum list',
  KITSU_EPISODES_PAGE: 'Episode list',
  KITSU_EPISODE_PAGE: 'Episode page',
  STREAMING_SERIES: 'Streaming links',
  STREAM_PLAYBACK: 'Stream playback',
  SLUG_CACHE: 'Slug cache',
  SLUG_RESOLUTION: 'Slug resolution',
  ID_MAPPING: 'ID mapping',
  STREAMING_PICK_PREFERENCE: 'Pick preference',
};

const SOURCE_LABELS: Record<string, string> = {
  anilist: 'AniList',
  kitsu: 'Kitsu',
  animeapi: 'AnimeAPI',
  provider: 'Provider',
  derived: 'Derived',
  local: 'Local',
};

/** Session = since launch; lifetime = persisted from previous runs. Both are incremented per event. Use session for "this run" display. */
function mergeCounters(a: CacheMetricsCounters, b: CacheMetricsCounters): CacheMetricsCounters {
  const out = { ...a };
  for (const k of Object.keys(out) as (keyof CacheMetricsCounters)[]) {
    (out as Record<string, number>)[k] = ((a[k] as number) ?? 0) + ((b[k] as number) ?? 0);
  }
  return out;
}

export type TimeWindowChoice = 'session' | 'lifetime';

export function buildCacheInsightsViewModel(
  snapshot: CacheMetricsSnapshot | null,
  timeWindow: TimeWindowChoice = 'lifetime'
): CacheInsightsViewModel {
  if (!snapshot) {
    return {
      totalReads: 0,
      totalWrites: 0,
      cacheHitRate: 0,
      readsServedWithoutNetwork: 0,
      requestsAvoidedTotal: 0,
      estimatedSavedMs: 0,
      memoryHits: 0,
      persistentHits: 0,
      entityHits: 0,
      cacheMisses: 0,
      networkFetches: 0,
      requestsAvoidedFresh: 0,
      staleServedOnError: 0,
      staleServedWhileRateLimited: 0,
      duplicateRequestsCollapsed: 0,
      entityReconstructions: 0,
      negativeCacheHits: 0,
      recoveredDuringSourceIssues: 0,
      backgroundRevalidationsStarted: 0,
      backgroundRevalidationsSucceeded: 0,
      backgroundRevalidationsFailed: 0,
      evictionsTotal: 0,
      topNamespaces: [],
      sourceMetrics: [],
      hasData: false,
      timeWindow,
    };
  }

  const merged =
    timeWindow === 'session'
      ? { ...snapshot.session }
      : mergeCounters(snapshot.session, snapshot.lifetime);
  const totalReads = merged.totalReads || 1;
  const memoryHits = merged.memoryHits;
  const persistentHits = merged.persistentHits;
  const entityHits = merged.entityHits;
  const negativeHits = merged.negativeCacheHits;
  const cacheMisses = merged.cacheMisses;
  const allHits = memoryHits + persistentHits + entityHits + negativeHits;
  const cacheHitRate = totalReads > 0 ? allHits / totalReads : 0;

  /** Reads served from cache without a synchronous network fetch. Distinct from requests avoided. */
  const readsServedWithoutNetwork = memoryHits + persistentHits + entityHits + negativeHits;

  /**
   * Network requests fully avoided (no fetch, not even in background).
   * Excludes stale-with-revalidation (background fetch still occurs).
   */
  const requestsAvoidedTotal =
    merged.requestsAvoidedFresh +
    merged.requestsAvoidedNegative +
    merged.requestsAvoidedBySourceHealth +
    merged.requestsDeduped +
    merged.entityPageReconstructions;

  /** Conservative estimated time saved: based on avoided count and observed/assumed network latency. */
  const networkFetches = merged.networkFetches || 1;
  const totalNetworkMs =
    timeWindow === 'session'
      ? (snapshot.sessionTiming?.totalNetworkFetchMs ?? 0)
      : (snapshot.sessionTiming?.totalNetworkFetchMs ?? 0) +
        (snapshot.lifetimeTiming?.totalNetworkFetchMs ?? 0);
  const avgNetworkMs = totalNetworkMs / Math.max(1, networkFetches);
  const msPerAvoided = Math.min(
    Math.max(avgNetworkMs, CONSERVATIVE_MS_PER_AVOIDED),
    MAX_MS_PER_AVOIDED
  );
  const estimatedSavedMs = Math.max(0, Math.round(requestsAvoidedTotal * msPerAvoided));

  const recoveredDuringSourceIssues =
    merged.staleServedOnError +
    merged.staleServedWhileRateLimited +
    merged.deferredRefreshes;

  const evictionsTotal =
    merged.evictionsExpired +
    merged.evictionsBroken +
    merged.evictionsNamespaceLimit +
    merged.evictionsGlobalLimit;

  /** Top namespaces by usefulness: avoidedRequests*2 + hits + deduped + entityFallbacks*3. */
  const topNamespaces = Object.entries(snapshot.namespaces ?? {})
    .map(([ns, m]) => {
      const n = m as NamespaceMetrics;
      const usefulnessScore =
        (n.avoidedRequests ?? 0) * 2 +
        (n.hits ?? 0) +
        (n.deduped ?? 0) +
        (n.entityFallbacks ?? 0) * 3;
      return {
        namespace: ns,
        label: NAMESPACE_LABELS[ns] ?? ns.replace(/_/g, ' '),
        reads: n.reads ?? 0,
        hits: n.hits ?? 0,
        avoidedRequests: n.avoidedRequests ?? 0,
        usefulnessScore,
      };
    })
    .filter((x) => x.reads > 0 || x.hits > 0 || x.avoidedRequests > 0)
    .sort((a, b) => b.usefulnessScore - a.usefulnessScore)
    .slice(0, 8);

  const sourceMetrics = Object.entries(snapshot.sources ?? {}).map(([src, m]) => {
    const s = m as SourceMetrics;
    return {
      source: src,
      label: SOURCE_LABELS[src] ?? src,
      successes: s.successes ?? 0,
      failures: s.failures ?? 0,
      rateLimited: s.rateLimited ?? 0,
      staleFallbacks: s.staleFallbacks ?? 0,
      deferredRefreshes: s.deferredRefreshes ?? 0,
    };
  });

  return {
    totalReads: merged.totalReads,
    totalWrites: merged.totalWrites,
    cacheHitRate,
    readsServedWithoutNetwork,
    requestsAvoidedTotal,
    estimatedSavedMs,
    memoryHits,
    persistentHits,
    entityHits,
    cacheMisses,
    networkFetches: merged.networkFetches,
    requestsAvoidedFresh: merged.requestsAvoidedFresh,
    staleServedOnError: merged.staleServedOnError,
    staleServedWhileRateLimited: merged.staleServedWhileRateLimited,
    duplicateRequestsCollapsed: merged.requestsDeduped,
    entityReconstructions: merged.entityPageReconstructions,
    negativeCacheHits: merged.negativeCacheHits,
    recoveredDuringSourceIssues,
    backgroundRevalidationsStarted: merged.backgroundRevalidationsStarted,
    backgroundRevalidationsSucceeded: merged.backgroundRevalidationsSucceeded,
    backgroundRevalidationsFailed: merged.backgroundRevalidationsFailed,
    evictionsTotal,
    topNamespaces,
    sourceMetrics,
    timeWindow,
    hasData:
      merged.totalReads > 0 ||
      merged.totalWrites > 0 ||
      merged.networkFetches > 0 ||
      requestsAvoidedTotal > 0,
  };
}
