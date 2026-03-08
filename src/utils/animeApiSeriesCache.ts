/**
 * Persistent cache for AnimeAPI (animeapi.net) series data keyed by MAL id.
 * Uses new policy-driven cache with STREAMING_SERIES namespace.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as cacheService from '@/cache/cacheService';
import { recordCacheMetric } from '@/cache/metrics';

const NAMESPACE = 'STREAMING_SERIES';
const LEGACY_PREFIX = 'featherneko_animeapi_series_';

/** Stream links in episodes are considered stale after this (24h). */
export const STREAM_LINKS_TTL_MS = 24 * 60 * 60 * 1000;

/** Episode from API: sub/dub have url and headers (Referer, User-Agent, Origin). */
export interface AnimeAPICachedEpisode {
  id?: string;
  episode?: string;
  title?: string;
  image?: string;
  sub?: { url?: string; headers?: Record<string, string>; subtitles?: unknown[] };
  dub?: { url?: string; headers?: Record<string, string> } | null;
}

/** One result from GET /anime/:query (one series match). */
export interface AnimeAPICachedResult {
  id?: string;
  title?: string;
  image?: string;
  provider?: string;
  type?: string;
  score?: number;
  episodes?: AnimeAPICachedEpisode[];
}

export interface StoredSeries {
  results: AnimeAPICachedResult[];
  fetchedAt: number;
  queryUsed?: string;
}

function cacheKey(malId: number): string {
  return `animeapi:${malId}`;
}

/** Get cached AnimeAPI results for this series (by MAL id). Returns null if not cached. */
export async function getAnimeApiSeriesCache(malId: number): Promise<AnimeAPICachedResult[] | null> {
  const withMeta = await getAnimeApiSeriesCacheWithMeta(malId);
  return withMeta?.results ?? null;
}

/** Get cache with fetchedAt so callers can trigger background refresh when streams are stale. */
export async function getAnimeApiSeriesCacheWithMeta(malId: number): Promise<StoredSeries | null> {
  const key = cacheKey(malId);
  const result = await cacheService.get<StoredSeries>(NAMESPACE, key);
  if (result.hit && result.data) {
    const stored = result.data as StoredSeries;
    if (Array.isArray(stored?.results)) {
      return { results: stored.results, fetchedAt: stored.fetchedAt ?? result.meta?.fetchedAt ?? Date.now(), queryUsed: stored.queryUsed };
    }
  }
  const legacy = await AsyncStorage.getItem(LEGACY_PREFIX + malId);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as StoredSeries | AnimeAPICachedResult[];
      let stored: StoredSeries | null = null;
      if (Array.isArray(parsed)) {
        stored = { results: parsed, fetchedAt: Date.now(), queryUsed: undefined };
      } else if (parsed?.results && Array.isArray(parsed.results)) {
        stored = { results: parsed.results, fetchedAt: parsed.fetchedAt ?? 0, queryUsed: parsed.queryUsed };
      }
      if (stored?.results) {
        recordCacheMetric('legacy_cache_fallback_used', { namespace: NAMESPACE });
        await setAnimeApiSeriesCache(malId, stored.results, stored.queryUsed);
        await AsyncStorage.removeItem(LEGACY_PREFIX + malId);
        return stored;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Save AnimeAPI results for this series. */
export async function setAnimeApiSeriesCache(
  malId: number,
  results: AnimeAPICachedResult[],
  queryUsed?: string
): Promise<void> {
  const key = cacheKey(malId);
  await cacheService.set(NAMESPACE, key, {
    results,
    fetchedAt: Date.now(),
    queryUsed: queryUsed ?? undefined,
  });
}

/** Clear all AnimeAPI series cache entries. */
export async function clearAllAnimeApiSeriesCache(): Promise<void> {
  await cacheService.clearNamespace(NAMESPACE);
}
