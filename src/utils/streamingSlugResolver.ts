/**
 * Consumet-style streaming: search and watch URL building per provider.
 * Search: https://api.consumet.org/anime/<provider>/{query}
 * Watch URLs differ by provider (path vs query episodeId, episode id format).
 * Slug cache is in-memory and persisted (permanent); cleared when user clears API cache.
 */

import axios from 'axios';
import { fetchWithSourceHealth } from '@/cache/fetchWithSourceHealth';
import { get, set } from '@/cache';

const slugCache = new Map<string, string>();

/** Cache key: malId + provider so different providers can have different slugs */
function cacheKey(malId: number, providerId: string): string {
  return `${malId}:${providerId}`;
}

/** Build a search-friendly query from a title (strip parentheticals, slugify). */
export function toSearchQuery(title: string | null | undefined): string {
  if (!title || typeof title !== 'string') return '';
  return title
    .replace(/\s*\([^)]*\)\s*/g, ' ') // remove (2024), (TV), etc.
    .replace(/\s*[-–—]\s*.*$/, '')   // remove " - Part 2" etc.
    .trim();
}

/** Encode for path: lowercase, collapse spaces to hyphen. */
export function toPathSegment(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s:]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Single search result from consumet search (id = provider's anime id/slug). */
export interface StreamingSearchResult {
  id: string;
  title?: string;
  url?: string;
  image?: string;
  releaseDate?: string;
  subOrDub?: string;
}

export interface StreamingSearchResponse {
  results: StreamingSearchResult[];
  currentPage?: number;
  hasNextPage?: boolean;
}

/** Append Vercel deployment protection bypass query params if token is set. */
export function appendVercelBypass(url: string, bypassToken: string | undefined): string {
  if (!bypassToken?.trim()) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(bypassToken.trim())}`;
}

/** Search one provider: GET /anime/<provider>/{query}. Same pattern for all providers. */
export async function searchProvider(
  baseUrl: string,
  providerId: string,
  query: string,
  page: number = 1,
  bypassToken?: string
): Promise<StreamingSearchResponse> {
  const base = baseUrl.replace(/\/$/, '');
  const q = query.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'anime';
  let url = `${base}/anime/${providerId}/${encodeURIComponent(q)}`;
  url = appendVercelBypass(url, bypassToken);
  const { data } = await axios.get<StreamingSearchResponse>(url, {
    params: { page },
    timeout: 10000,
  });
  const results = Array.isArray(data?.results) ? data.results : [];
  return {
    results: results.filter((r): r is StreamingSearchResult => Boolean(r?.id)),
    currentPage: data?.currentPage ?? page,
    hasNextPage: data?.hasNextPage ?? false,
  };
}

/** Build episode id string for watch URL (programmatic formats only). */
export function buildEpisodeIdForProvider(
  providerId: string,
  providerAnimeId: string,
  episodeNumber: number
): string {
  const num = episodeNumber;
  const id = providerAnimeId;
  switch (providerId) {
    case 'animekai':
      return `${id}-episode-${num}`;
    case 'animesama':
      return `${id}-episode-${num}`;
    case 'animesaturn':
      return `${id}-episodio-${num}`;
    case 'animeunity':
      return `${id}/${num}`;
    case 'hianime':
      return `${id}-${num}`;
    case 'kickassanime':
      return `${id}/episode/ep-${num}`;
    case 'animepahe':
      return id;
    default:
      return `${id}-episode-${num}`;
  }
}

/** AnimePahe uses hash episode ids; fetch from info endpoint. */
export async function fetchAnimePaheEpisodeId(
  baseUrl: string,
  animeId: string,
  episodeNumber: number,
  bypassToken?: string
): Promise<string | null> {
  const base = baseUrl.replace(/\/$/, '');
  let url = `${base}/anime/animepahe/info`;
  url = appendVercelBypass(url, bypassToken);
  const { data } = await axios.get(url, { params: { id: animeId }, timeout: 10000 });
  const episodes = data?.episodes ?? data?.episodeList;
  if (!Array.isArray(episodes)) return null;
  const ep = episodes.find(
    (e: { number?: number; episodeNum?: number }) =>
      Number(e?.number ?? e?.episodeNum) === episodeNumber
  );
  return ep?.id ?? null;
}

/** Build full watch URL for a provider (path vs query episodeId, optional server). */
export function buildWatchUrl(
  baseUrl: string,
  providerId: string,
  episodeId: string,
  server?: string,
  bypassToken?: string
): string {
  const base = baseUrl.replace(/\/$/, '');
  const pathBase = `${base}/anime/${providerId}/watch`;
  const useQuery = providerId === 'animesama' || providerId === 'kickassanime';
  const encoded = encodeURIComponent(episodeId);
  let url: string;
  if (useQuery) {
    url = `${pathBase}?episodeId=${encoded}`;
    if (server) url += `&server=${encodeURIComponent(server)}`;
  } else {
    url = `${pathBase}/${encoded}`;
    if (server) url += `?server=${encodeURIComponent(server)}`;
  }
  return appendVercelBypass(url, bypassToken);
}

interface SearchResult {
  id?: string;
  title?: string;
}

interface SearchResponse {
  results?: SearchResult[];
  currentPage?: number;
  hasNextPage?: boolean;
}

/**
 * Search the streaming API for an anime by title and return the provider's slug (id).
 * Tries romaji first, then english, then shortened variants. Caches result by malId + provider.
 */
/** Clear in-memory slug cache (e.g. when user clears API cache). Persisted slug cache is cleared via cache.clearBuckets. */
export function clearSlugCacheMemory(): void {
  slugCache.clear();
}

export async function resolveProviderSlug(
  baseUrl: string,
  providerId: string,
  malId: number,
  titleRomaji: string | null | undefined,
  titleEnglish: string | null | undefined
): Promise<string | null> {
  const key = cacheKey(malId, providerId);
  const memCached = slugCache.get(key);
  if (memCached) return memCached;
  const persisted = await get('SLUG_CACHE', key);
  if (typeof persisted === 'string') {
    slugCache.set(key, persisted);
    return persisted;
  }

  const queries: string[] = [];
  const r = toSearchQuery(titleRomaji);
  const e = toSearchQuery(titleEnglish);
  if (r) queries.push(toPathSegment(r), r.replace(/\s+/g, '-').toLowerCase());
  if (e && e !== r) queries.push(toPathSegment(e), e.replace(/\s+/g, '-').toLowerCase());
  // Dedupe and remove empty
  const toTry = [...new Set(queries)].filter(Boolean);

  const base = baseUrl.replace(/\/$/, '');
  const trySearch = async (url: string): Promise<SearchResponse | null> => {
    try {
      const { data } = await fetchWithSourceHealth<SearchResponse>(url, { timeout: 10000, source: 'provider' });
      return data;
    } catch {
      return null;
    }
  };

  for (const query of toTry) {
    const pathEncoded = encodeURIComponent(query.replace(/-/g, ' '));
    const data =
      (await trySearch(`${base}/anime/${providerId}/${pathEncoded}`)) ??
      (await trySearch(`${base}/anime/${providerId}/search?q=${encodeURIComponent(query.replace(/-/g, ' '))}`));
    const results = data?.results;
    if (Array.isArray(results) && results.length > 0 && results[0].id) {
      const slug = results[0].id;
      slugCache.set(key, slug);
      set('SLUG_CACHE', key, slug).catch(() => {});
      if (__DEV__) console.log('[Stream] Resolved slug for MAL', malId, providerId, '->', slug);
      return slug;
    }
  }

  if (__DEV__) console.warn('[Stream] No search results for MAL', malId, 'provider:', providerId, 'queries:', toTry);
  return null;
}

/** @deprecated Use resolveProviderSlug with providerId */
export async function resolveGogoSlug(
  baseUrl: string,
  malId: number,
  titleRomaji: string | null | undefined,
  titleEnglish: string | null | undefined
): Promise<string | null> {
  return resolveProviderSlug(baseUrl, 'animekai', malId, titleRomaji, titleEnglish);
}

/**
 * Build the episode id for the watch URL. Uses resolved provider slug when available,
 * otherwise falls back to title-based slug (current behavior).
 */
export function buildEpisodeId(
  providerSlug: string | null,
  titleRomaji: string | null | undefined,
  titleEnglish: string | null | undefined,
  episodeNumber: number
): string {
  const base = providerSlug ?? toPathSegment(
    toSearchQuery(titleRomaji) || toSearchQuery(titleEnglish) || 'anime'
  );
  return `${base}-episode-${episodeNumber}`;
}
