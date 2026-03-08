/**
 * Persistent cache eviction: remove broken, expired, and low-value entries.
 * Does NOT touch entity store or durable data.
 */

import type { IndexEntry } from "../storage/cacheStorage";
import { AsyncStorageCacheStorage } from "../storage/asyncStorageCacheStorage";
import type { CacheStorage } from "../storage/cacheStorage";
import { now } from "../utils/clock";
import { cacheLog } from "../utils/logger";
import { recordCacheMetric } from "../metrics";

const GLOBAL_MAX_ENTRIES = 2000;
const NAMESPACE_MAX = 500;

let storageInstance: CacheStorage | null = null;

function getStorageInstance(): CacheStorage {
  if (!storageInstance) {
    storageInstance = new AsyncStorageCacheStorage();
  }
  return storageInstance;
}

/** Namespaces that are response cache only (safe to evict). Entity-store namespaces excluded. */
const RESPONSE_CACHE_NAMESPACES = new Set([
  "HOME_FEED",
  "ANILIST_FEED",
  "ANILIST_MEDIA",
  "ANILIST_MEDIA_VOLATILE",
  "ANILIST_CHARACTERS",
  "ANILIST_REVIEWS",
  "ANILIST_RECOMMENDATIONS",
  "MAL_FORUM_TOPIC",
  "JIKAN_FORUM_LIST",
  "KITSU_EPISODES_PAGE",
  "KITSU_EPISODE_PAGE",
  "STREAMING_SERIES",
  "STREAM_PLAYBACK",
  "SLUG_CACHE",
  "SLUG_RESOLUTION",
  "STREAMING_PICK_PREFERENCE",
]);

export async function evictExpiredEntries(): Promise<number> {
  const s = getStorageInstance();
  const index = await s.getIndex();
  const n = now();
  const toRemove: IndexEntry[] = [];
  for (const e of index) {
    if (!RESPONSE_CACHE_NAMESPACES.has(e.namespace)) continue;
    if (e.immutable) continue;
    const hard = e.hardExpiresAt ?? 0;
    if (hard > 0 && n > hard) toRemove.push(e);
  }
  for (const e of toRemove) {
    await s.remove(e.namespace, e.key);
  }
  const remaining = index.filter(
    (x) =>
      !toRemove.some(
        (r) => r.namespace === x.namespace && r.key === x.key
      )
  );
  await s.updateIndex(remaining);
  if (toRemove.length) {
    recordCacheMetric("eviction_expired", { delta: toRemove.length });
    cacheLog("evicted expired", toRemove.length);
  }
  return toRemove.length;
}

export async function enforceNamespaceLimits(namespace: string): Promise<number> {
  const s = getStorageInstance();
  const index = await s.getIndex();
  const entries = index.filter((e) => e.namespace === namespace);
  if (entries.length <= NAMESPACE_MAX) return 0;

  const sorted = [...entries].sort(
    (a, b) => (a.lastAccessedAt ?? 0) - (b.lastAccessedAt ?? 0)
  );
  const toRemove = sorted.slice(0, entries.length - NAMESPACE_MAX);
  for (const e of toRemove) {
    await s.remove(e.namespace, e.key);
  }
  const remaining = index.filter(
    (x) =>
      !toRemove.some(
        (r) => r.namespace === x.namespace && r.key === x.key
      )
  );
  await s.updateIndex(remaining);
  if (toRemove.length) {
    recordCacheMetric("eviction_namespace_limit", { namespace, delta: toRemove.length });
    cacheLog("evicted namespace overlimit", namespace, toRemove.length);
  }
  return toRemove.length;
}

export async function evictBrokenEntries(): Promise<number> {
  const s = getStorageInstance();
  const index = await s.getIndex();
  const toRemove: IndexEntry[] = [];
  for (const e of index) {
    if (!RESPONSE_CACHE_NAMESPACES.has(e.namespace)) continue;
    const entry = await s.get(e.namespace, e.key);
    if (!entry) toRemove.push(e);
  }
  for (const e of toRemove) {
    await s.remove(e.namespace, e.key);
  }
  const remaining = index.filter(
    (x) =>
      !toRemove.some(
        (r) => r.namespace === x.namespace && r.key === x.key
      )
  );
  await s.updateIndex(remaining);
  if (toRemove.length) {
    recordCacheMetric("eviction_broken", { delta: toRemove.length });
    cacheLog("evicted broken/orphaned", toRemove.length);
  }
  return toRemove.length;
}

export async function enforceGlobalPersistentLimits(): Promise<number> {
  const s = getStorageInstance();
  const index = await s.getIndex();
  const responseOnly = index.filter((e) => RESPONSE_CACHE_NAMESPACES.has(e.namespace));
  if (responseOnly.length <= GLOBAL_MAX_ENTRIES) return 0;

  const sorted = [...responseOnly].sort(
    (a, b) => (a.lastAccessedAt ?? 0) - (b.lastAccessedAt ?? 0)
  );
  const toRemove = sorted.slice(0, responseOnly.length - GLOBAL_MAX_ENTRIES);
  for (const e of toRemove) {
    await s.remove(e.namespace, e.key);
  }
  const remaining = index.filter(
    (x) =>
      !toRemove.some(
        (r) => r.namespace === x.namespace && r.key === x.key
      )
  );
  await s.updateIndex(remaining);
  if (toRemove.length) {
    recordCacheMetric("eviction_global_limit", { delta: toRemove.length });
    cacheLog("evicted global overlimit", toRemove.length);
  }
  return toRemove.length;
}

/**
 * Full cleanup: broken/orphaned, then expired, then namespace limits, then global limits.
 * Call on app start or periodically.
 */
export async function cleanupPersistentCache(): Promise<{
  broken: number;
  expired: number;
  namespace: number;
  global: number;
}> {
  const broken = await evictBrokenEntries();
  const expired = await evictExpiredEntries();
  let namespaceTotal = 0;
  for (const ns of RESPONSE_CACHE_NAMESPACES) {
    namespaceTotal += await enforceNamespaceLimits(ns);
  }
  const global = await enforceGlobalPersistentLimits();
  return { broken, expired, namespace: namespaceTotal, global };
}
