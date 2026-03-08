/**
 * Normalized local cache store: single AsyncStorage-backed "database" that fills
 * as the user uses the app. Used to minimize server requests.
 *
 * - Permanent: Anilist media (posters, titles, metadata), image URLs, slug cache.
 * - TTL: Home feed (e.g. 30 min), streaming links (handled in animeApiSeriesCache).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'featherneko_cache_v1';

const CACHE_KEYS = {
  /** Anilist media by malId. Permanent (metadata/posters don't change). */
  ANILIST_MEDIA: 'anilist_media',
  /** Home feed (trending, season, etc.). TTL 30 min. */
  ANILIST_FEED: 'anilist_feed',
  /** Slug cache malId:providerId -> slug. Permanent. */
  SLUG_CACHE: 'slug_cache',
  /** Anilist characters by malId. Permanent. */
  ANILIST_CHARACTERS: 'anilist_characters',
  /** Anilist reviews by malId. Permanent. */
  ANILIST_REVIEWS: 'anilist_reviews',
  /** Anilist recommendations by malId. Permanent. */
  ANILIST_RECOMMENDATIONS: 'anilist_recommendations',
  /** Kitsu episodes by "malId_page". Permanent (episode list rarely changes). */
  KITSU_EPISODES_PAGE: 'kitsu_episodes_page',
} as const;

export type CacheBucket = keyof typeof CACHE_KEYS;

/** Entry with optional expiry. If no expiresAt, treat as permanent. */
export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  expiresAt?: number;
}

let memory: Record<string, unknown> | null = null;

async function readAll(): Promise<Record<string, unknown>> {
  if (memory) return memory as Record<string, unknown>;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    memory = raw ? JSON.parse(raw) : {};
  } catch {
    memory = {};
  }
  return memory as Record<string, unknown>;
}

async function writeAll(data: Record<string, unknown>): Promise<void> {
  memory = data;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    if (__DEV__) console.warn('[cacheStore] write failed', e);
  }
}

function isExpired(entry: CacheEntry<unknown> | null): boolean {
  if (!entry) return true;
  if (entry.expiresAt == null) return false; // permanent
  return Date.now() > entry.expiresAt;
}

/** Get a bucket's full content (e.g. anilist_media = Record<malId, CacheEntry<Media>>). */
export async function getBucket<K extends CacheBucket>(
  bucket: K
): Promise<Record<string, CacheEntry<unknown>>> {
  const all = await readAll();
  const raw = all[bucket];
  if (raw == null || typeof raw !== 'object') return {};
  return raw as Record<string, CacheEntry<unknown>>;
}

/** Get one key from a bucket. Returns null if missing or expired. */
export async function get<K extends CacheBucket>(
  bucket: K,
  key: string
): Promise<unknown | null> {
  const bucketData = await getBucket(bucket);
  const entry = bucketData[key] as CacheEntry<unknown> | undefined;
  if (!entry || isExpired(entry)) return null;
  return entry.data;
}

/** Set one key in a bucket. ttlMs optional; omit for permanent. */
export async function set<K extends CacheBucket>(
  bucket: K,
  key: string,
  data: unknown,
  ttlMs?: number
): Promise<void> {
  const all = await readAll();
  if (!all[bucket] || typeof all[bucket] !== 'object') (all as Record<string, unknown>)[bucket] = {};
  const bucketData = (all as Record<string, Record<string, CacheEntry<unknown>>>)[bucket];
  const now = Date.now();
  bucketData[key] = {
    data,
    fetchedAt: now,
    expiresAt: ttlMs != null ? now + ttlMs : undefined,
  };
  await writeAll(all);
}

/** Merge multiple keys into a bucket (e.g. merge many media by malId). Overwrites per key. */
export async function setMany<K extends CacheBucket>(
  bucket: K,
  entries: Record<string, { data: unknown; ttlMs?: number }>
): Promise<void> {
  const all = await readAll();
  if (!all[bucket] || typeof all[bucket] !== 'object') (all as Record<string, unknown>)[bucket] = {};
  const bucketData = (all as Record<string, Record<string, CacheEntry<unknown>>>)[bucket];
  const now = Date.now();
  for (const [k, v] of Object.entries(entries)) {
    bucketData[k] = {
      data: v.data,
      fetchedAt: now,
      expiresAt: v.ttlMs != null ? now + v.ttlMs : undefined,
    };
  }
  await writeAll(all);
}

/** Remove one key from a bucket. */
export async function remove<K extends CacheBucket>(bucket: K, key: string): Promise<void> {
  const all = await readAll();
  const bucketData = all[bucket] as Record<string, unknown> | undefined;
  if (bucketData && key in bucketData) {
    delete bucketData[key];
    await writeAll(all);
  }
}

/** Clear specific buckets (e.g. anilist_feed only) or all cache. */
export async function clearBuckets(buckets?: CacheBucket[]): Promise<void> {
  const all = await readAll();
  if (buckets) {
    for (const b of buckets) delete all[b];
  } else {
    for (const k of Object.keys(all)) delete all[k];
  }
  await writeAll(all);
}

/** Home feed TTL: 30 minutes. */
export const HOME_FEED_TTL_MS = 30 * 60 * 1000;
