/**
 * Streaming API: AnimeAPI (animeapi.net) only.
 * GET /anime/:query; response is cached per series (MAL id).
 */

import axios from 'axios';
import { fetchWithSourceHealth } from '@/cache/fetchWithSourceHealth';
import type { StreamingSearchResult, StreamingSearchResponse } from './streamingSlugResolver';
import {
  getAnimeApiSeriesCacheWithMeta,
  setAnimeApiSeriesCache,
  STREAM_LINKS_TTL_MS,
  type AnimeAPICachedResult,
} from './animeApiSeriesCache';

export type { StreamingSearchResult, StreamingSearchResponse };

export interface StreamSource {
  url: string;
  quality: string;
  isM3U8: boolean;
}

export interface StreamResult {
  sources: StreamSource[];
  headers?: { Referer?: string; 'User-Agent'?: string; Origin?: string } | null;
  /** Episode snapshot/thumbnail from API (e.g. animepahe) for player poster. */
  episodeImage?: string | null;
}

/** Options passed to fetchStream; adapters interpret as needed (e.g. server, dub, malId for AnimeAPI cache). */
export interface FetchStreamOptions {
  providerId?: string;
  server?: string;
  dub?: boolean;
  /** MAL id; used by AnimeAPI adapter to read/write persistent series cache. */
  malId?: number;
}

/** Optional search options (e.g. malId to persist AnimeAPI response per series). */
export interface StreamingSearchOptions {
  malId?: number;
}

/** Single interface for any streaming backend: search + fetch stream. */
export interface IStreamingApi {
  search(query: string, page?: number, options?: StreamingSearchOptions): Promise<StreamingSearchResponse>;
  fetchStream(
    animeId: string,
    episodeNumber: number,
    options?: FetchStreamOptions
  ): Promise<StreamResult>;
  readonly hasProviderChoice: boolean;
}

/** Options to create an API instance; adapterKey selects implementation. */
export interface CreateStreamingApiOptions {
  /** Which adapter to use (must be registered). */
  adapterKey: string;
  /** Provider id (e.g. for Consumet: animekai, animepahe). Passed through to adapter. */
  providerId?: string;
  server?: string;
  bypassToken?: string;
}

type AdapterFactory = (baseUrl: string, options: CreateStreamingApiOptions) => IStreamingApi;

const adapterRegistry: Record<string, AdapterFactory> = {};

/**
 * Register a streaming adapter. To add a new source:
 * 1. Implement a class that satisfies IStreamingApi (search + fetchStream).
 * 2. Call registerStreamingAdapter('yourkey', (baseUrl, opts) => new YourAdapter(baseUrl, opts)).
 * 3. Add a provider in settingsSlice with adapterKey: 'yourkey' and baseUrl (or '' to use env).
 */
export function registerStreamingAdapter(key: string, factory: AdapterFactory): void {
  adapterRegistry[key] = factory;
}

function getAdapter(key: string): AdapterFactory {
  const factory = adapterRegistry[key];
  if (!factory) throw new Error(`Unknown streaming adapter: ${key}. Registered: ${Object.keys(adapterRegistry).join(', ') || 'none'}.`);
  return factory;
}

/** AnimeAPI episode: has sub/dub with url and headers; image is snapshot for player poster. */
interface AnimeAPIEpisode {
  episode?: string;
  title?: string;
  image?: string;
  sub?: { url?: string; headers?: Record<string, string> };
  dub?: { url?: string; headers?: Record<string, string> };
}

/** AnimeAPI result: id (UUID), title, image, episodes[] */
interface AnimeAPIResult {
  id?: string;
  title?: string;
  image?: string;
  episodes?: AnimeAPIEpisode[];
}

/** Module-level cache for AnimeAPI: GET /anime/:query is expensive; we never re-request same series. */
const animeApiQueryCache = new Map<string, AnimeAPIResult[]>();
const animeApiIdToResult = new Map<string, AnimeAPIResult>();

/** AnimeAPI adapter: only GET /anime/:query. Response is cached in memory and persisted by malId; fetchStream uses cache only. */
class AnimeAPIAdapter implements IStreamingApi {
  readonly hasProviderChoice = false;

  constructor(private baseUrl: string) {}

  async search(query: string, _page?: number, searchOptions?: { malId?: number }): Promise<StreamingSearchResponse> {
    const base = this.baseUrl.replace(/\/$/, '');
    const pathSegment = query.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'anime';

    let resultsList = animeApiQueryCache.get(pathSegment);
    if (!resultsList) {
      const url = `${base}/anime/${encodeURIComponent(pathSegment)}`;
      if (__DEV__) console.log('[AnimeAPI] GET', url, '(memory cache miss)');
      const { data } = await fetchWithSourceHealth(url, { timeout: 15000, source: 'animeapi' });
      if (__DEV__) console.log('[AnimeAPI] GET response:', { status: data?.status, resultsLength: data?.results?.length, query: data?.query });
      if (data?.status !== 'success' || !Array.isArray(data?.results)) {
        return { results: [], currentPage: 1, hasNextPage: false };
      }
      resultsList = data.results as AnimeAPIResult[];
      animeApiQueryCache.set(pathSegment, resultsList);
      for (const r of resultsList) {
        const id = r.id ?? (typeof r.title === 'string' ? r.title.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-') : '');
        if (id) animeApiIdToResult.set(id, r);
      }
      if (searchOptions?.malId != null) {
        await setAnimeApiSeriesCache(searchOptions.malId, resultsList, pathSegment);
        if (__DEV__) console.log('[AnimeAPI] persisted to series cache malId=', searchOptions.malId);
      }
    }

    const results: StreamingSearchResult[] = [];
    for (const r of resultsList) {
      const id = r.id ?? (typeof r.title === 'string' ? r.title.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-') : '');
      if (!id) continue;
      results.push({ id, title: r.title, image: r.image });
    }
    return { results, currentPage: 1, hasNextPage: false };
  }

  async fetchStream(
    animeId: string,
    episodeNumber: number,
    options?: FetchStreamOptions
  ): Promise<StreamResult> {
    const epStr = String(episodeNumber);

    if (options?.malId != null) {
      const withMeta = await getAnimeApiSeriesCacheWithMeta(options.malId);
      const persisted = withMeta?.results ?? null;
      if (__DEV__) console.log('[AnimeAPI] fetchStream persisted cache:', { malId: options.malId, resultsLength: persisted?.length });
      if (persisted?.length) {
        if (
          withMeta &&
          withMeta.queryUsed &&
          withMeta.fetchedAt < Date.now() - STREAM_LINKS_TTL_MS
        ) {
          const base = this.baseUrl.replace(/\/$/, '');
          const url = `${base}/anime/${encodeURIComponent(withMeta.queryUsed)}`;
          if (__DEV__) console.log('[AnimeAPI] streams stale, background refresh:', url);
          fetchWithSourceHealth(url, { timeout: 15000, source: 'animeapi' }).then(
            ({ data }) => {
              if (data?.status === 'success' && Array.isArray(data?.results)) {
                setAnimeApiSeriesCache(options.malId!, data.results as AnimeAPICachedResult[], withMeta.queryUsed);
              }
            },
            () => {}
          );
        }
        const result = persisted.find((r) => (r.id ?? '') === animeId);
        if (__DEV__) console.log('[AnimeAPI] fetchStream result by animeId:', { animeId, found: !!result, episodesCount: result?.episodes?.length });
        if (result?.episodes?.length) {
          const episode = result.episodes.find((e) => String(e?.episode) === epStr);
          if (__DEV__) console.log('[AnimeAPI] fetchStream episode:', { epStr, found: !!episode, hasSub: !!episode?.sub?.url, hasDub: !!episode?.dub?.url });
          if (episode) {
            const subOrDub = options?.dub ? episode.dub : episode.sub;
            const fallback = options?.dub ? episode.sub : episode.dub;
            const link = subOrDub ?? fallback;
            if (link?.url) {
              if (__DEV__) console.log('[AnimeAPI] fetchStream returning from persisted cache:', { url: link.url.slice(0, 60) + '...' });
              return {
                sources: [{ url: link.url, quality: 'default', isM3U8: link.url.includes('.m3u8') }],
                headers: link.headers ?? null,
                episodeImage: episode.image ?? null,
              };
            }
          }
        }
      }
    }

    const cached = animeApiIdToResult.get(animeId);
    if (__DEV__) console.log('[AnimeAPI] fetchStream in-memory cache:', { animeId, hasCached: !!cached, episodesCount: cached?.episodes?.length });
    if (!cached?.episodes?.length) {
      throw new Error('Anime not in cache. Open the episode again after the series has been loaded (GET /anime/:query).');
    }
    const episode = cached.episodes.find((e) => String(e?.episode) === epStr);
    if (!episode) {
      throw new Error(`Episode ${episodeNumber} not found for this anime.`);
    }
    const subOrDub = options?.dub ? episode.dub : episode.sub;
    const fallback = options?.dub ? episode.sub : episode.dub;
    const link = subOrDub ?? fallback;
    if (!link?.url) {
      throw new Error('No stream URL for this episode.');
    }
    return {
      sources: [{ url: link.url, quality: 'default', isM3U8: link.url.includes('.m3u8') }],
      headers: link.headers ?? null,
      episodeImage: episode.image ?? null,
    };
  }
}

/**
 * Create a streaming API instance (AnimeAPI only).
 */
export function createStreamingApi(baseUrl: string, options: CreateStreamingApiOptions): IStreamingApi {
  const base = (baseUrl?.trim() || '').replace(/\/$/, '');
  const factory = getAdapter(options.adapterKey);
  return factory(base, options);
}

registerStreamingAdapter('animeapi', (baseUrl) => {
  const base = baseUrl?.replace(/\/$/, '') || 'https://animeapi.net';
  return new AnimeAPIAdapter(base.startsWith('http') ? base : 'https://animeapi.net');
});
