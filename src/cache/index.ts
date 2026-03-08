/**
 * Cache module - backward-compatible facade over the new policy-driven cache.
 * Runs legacy migration on first use.
 */

import * as cacheService from './cacheService';
import { migrateAnitoerKeysIfNeeded } from './migration/migrateAnitoerKeys';
import { migrateIfNeeded } from './migration/migrateLegacyCache';
import { cleanupPersistentCache } from './persistent/eviction';
import { initCacheMetrics } from './metrics';

// Re-export bucket type for compatibility
export type CacheBucket =
  | 'ANILIST_MEDIA'
  | 'ANILIST_FEED'
  | 'ANILIST_GENRE_PAGE'
  | 'SLUG_CACHE'
  | 'ANILIST_CHARACTERS'
  | 'ANILIST_REVIEWS'
  | 'ANILIST_RECOMMENDATIONS'
  | 'KITSU_EPISODES_PAGE'
  | 'MAL_FORUM_TOPIC'
  | 'JIKAN_FORUM_LIST';

export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  expiresAt?: number;
}

export const HOME_FEED_TTL_MS = 30 * 60 * 1000;

let migrationPromise: Promise<boolean> | null = null;

async function ensureMigration(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      await migrateAnitoerKeysIfNeeded();
      await initCacheMetrics();
      const migrated = await migrateIfNeeded();
      cleanupPersistentCache().catch(() => {});
      return migrated;
    })();
  }
  await migrationPromise;
}

/** Backward-compatible get: returns data or null. */
export async function get<K extends CacheBucket>(
  bucket: K,
  key: string
): Promise<unknown | null> {
  await ensureMigration();
  const result = await cacheService.get(bucket, key);
  if (!result.hit) return null;
  return result.data;
}

/** Backward-compatible set. ttlMs ignored (policy-driven). Pass context for policy-aware TTL. */
export async function set<K extends CacheBucket>(
  bucket: K,
  key: string,
  data: unknown,
  _ttlMs?: number,
  context?: import('./types').CacheContext
): Promise<void> {
  await ensureMigration();
  await cacheService.set(bucket, key, data, context);
}

/** Backward-compatible setMany. */
export async function setMany<K extends CacheBucket>(
  bucket: K,
  entries: Record<string, { data: unknown; ttlMs?: number }>
): Promise<void> {
  await ensureMigration();
  for (const [k, v] of Object.entries(entries)) {
    await cacheService.set(bucket, k, v.data);
  }
}

/** Backward-compatible getBucket. Returns old CacheEntry shape. */
export async function getBucket<K extends CacheBucket>(
  bucket: K
): Promise<Record<string, CacheEntry<unknown>>> {
  await ensureMigration();
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const { META_INDEX_KEY, ENTRY_PREFIX } = await import('./keys');
  const rawIndex = await AsyncStorage.getItem(META_INDEX_KEY);
  const index = rawIndex ? JSON.parse(rawIndex) : [];
  const result: Record<string, CacheEntry<unknown>> = {};
  for (const e of index) {
    if (e.namespace !== bucket) continue;
    const entry = await cacheService.get(bucket, e.key);
    if (entry.hit && entry.data != null) {
      result[e.key] = {
        data: entry.data,
        fetchedAt: entry.meta?.fetchedAt ?? Date.now(),
        expiresAt: entry.meta?.hardExpiresAt,
      };
    }
  }
  return result;
}

/** Backward-compatible remove. */
export async function remove<K extends CacheBucket>(
  bucket: K,
  key: string
): Promise<void> {
  await ensureMigration();
  await cacheService.remove(bucket, key);
}

/** Backward-compatible clearBuckets. Omit = clear all. */
export async function clearBuckets(buckets?: CacheBucket[]): Promise<void> {
  await ensureMigration();
  if (buckets) {
    for (const b of buckets) await cacheService.clearNamespace(b);
  } else {
    await cacheService.clearAllCaches();
  }
}

/** New: clear response caches only (not entity store, not streaming pick). */
export async function clearResponseCachesOnly(): Promise<void> {
  await ensureMigration();
  const discovery = [
    'ANILIST_FEED', 'ANILIST_MEDIA', 'ANILIST_GENRE_PAGE', 'ANILIST_CHARACTERS',
    'ANILIST_REVIEWS', 'ANILIST_RECOMMENDATIONS', 'KITSU_EPISODES_PAGE',
    'MAL_FORUM_TOPIC', 'JIKAN_FORUM_LIST',
    'ANIME_MEDIA_STABLE', 'ANIME_MEDIA_VOLATILE',
  ];
  for (const ns of discovery) await cacheService.clearNamespace(ns);
}

/** New: clear streaming-related caches only. */
export async function clearStreamingCachesOnly(): Promise<void> {
  await ensureMigration();
  await cacheService.clearNamespace('STREAMING_SERIES');
  await cacheService.clearNamespace('SLUG_CACHE');
  await cacheService.clearNamespace('SLUG_RESOLUTION');
}

/** New: clear discovery caches (home feed, etc.) only. */
export async function clearDiscoveryCachesOnly(): Promise<void> {
  await ensureMigration();
  await cacheService.clearNamespace('ANILIST_FEED');
  await cacheService.clearNamespace('HOME_FEED');
  await cacheService.clearNamespace('ANILIST_GENRE_PAGE');
}

export { getAnimeMedia, setAnimeMedia } from './animeMediaCache';
