/**
 * Metadata index for the response cache. Tracks entries for eviction and stats.
 */

import type { CacheEntryMeta } from '../types';
import type { IndexEntry } from '../storage/cacheStorage';
import { hashKey } from '../utils/hashing';

export function metaToIndexEntry(meta: CacheEntryMeta): IndexEntry {
  return {
    namespace: meta.namespace,
    key: meta.key,
    hashedKey: hashKey(meta.key),
    softExpiresAt: meta.softExpiresAt,
    hardExpiresAt: meta.hardExpiresAt,
    lastAccessedAt: meta.lastAccessedAt,
    accessCount: meta.accessCount,
    negative: meta.negative,
    immutable: meta.immutable,
  };
}

export function addOrUpdateIndex(
  existing: IndexEntry[],
  meta: CacheEntryMeta
): IndexEntry[] {
  const entry = metaToIndexEntry(meta);
  const key = `${meta.namespace}:${meta.key}`;
  const filtered = existing.filter((e) => `${e.namespace}:${e.key}` !== key);
  return [...filtered, entry];
}

export function removeFromIndex(
  existing: IndexEntry[],
  namespace: string,
  key: string
): IndexEntry[] {
  const k = `${namespace}:${key}`;
  return existing.filter((e) => `${e.namespace}:${e.key}` !== k);
}
