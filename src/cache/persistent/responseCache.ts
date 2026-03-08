/**
 * Persistent response cache. Reads/writes through per-entry storage.
 */

import type { CacheEntry, CacheEntryMeta, CacheContext, ResolvedCachePolicy } from '../types';
import type { CacheStorage } from '../storage/cacheStorage';
import { AsyncStorageCacheStorage } from '../storage/asyncStorageCacheStorage';
import { resolvePolicy } from '../policyEngine';
import { evaluateCacheStatus } from '../utils/cacheStatus';
import { now } from '../utils/clock';
import { addOrUpdateIndex, removeFromIndex } from './cacheIndex';
import { cacheLog } from '../utils/logger';
import { cleanupPersistentCache } from './eviction';

let storage: CacheStorage | null = null;

function getStorage(): CacheStorage {
  if (!storage) storage = new AsyncStorageCacheStorage();
  return storage;
}

export async function getFromResponseCache<T>(
  namespace: string,
  key: string,
  context?: CacheContext | null
): Promise<{ entry: CacheEntry<T> | null; status: ReturnType<typeof evaluateCacheStatus> }> {
  const s = getStorage();
  const raw = await s.get(namespace, key);
  if (!raw) return { entry: null, status: 'broken' };
  const status = evaluateCacheStatus(raw.meta, raw.data);
  return { entry: raw as CacheEntry<T>, status };
}

export async function setToResponseCache<T>(
  namespace: string,
  key: string,
  data: T,
  context?: CacheContext | null,
  overrides?: Partial<CacheEntryMeta>
): Promise<void> {
  const policy = resolvePolicy(namespace, context);
  const n = now();
  const softExp = n + policy.effectiveSoftTtlMs;
  const hardExp = n + policy.effectiveHardTtlMs;

  const meta: CacheEntryMeta = {
    namespace,
    key,
    version: 1,
    createdAt: n,
    updatedAt: n,
    fetchedAt: n,
    lastAccessedAt: n,
    accessCount: 0,
    softExpiresAt: softExp,
    hardExpiresAt: hardExp,
    immutable: policy.immutable,
    negative: false,
    source: policy.source,
    ...overrides,
  };

  const entry: CacheEntry<T> = { meta, data };
  const s = getStorage();
  await s.set(entry as CacheEntry<unknown>);

  const index = await s.getIndex();
  const newIndex = addOrUpdateIndex(index, meta);
  await s.updateIndex(newIndex);

  if (newIndex.length > 1500) {
    cleanupPersistentCache().catch(() => {});
  }
}

export async function setNegativeToResponseCache(
  namespace: string,
  key: string,
  reason?: string,
  context?: CacheContext | null
): Promise<void> {
  const policy = resolvePolicy(namespace, context);
  const n = now();
  const hardExp = n + policy.effectiveNegativeTtlMs;

  const meta: CacheEntryMeta = {
    namespace,
    key,
    version: 1,
    createdAt: n,
    updatedAt: n,
    fetchedAt: n,
    lastAccessedAt: n,
    accessCount: 0,
    hardExpiresAt: hardExp,
    negative: true,
    source: policy.source,
    context: reason ? { reason } : undefined,
  };

  const entry: CacheEntry<unknown> = { meta, data: null };
  const s = getStorage();
  await s.set(entry);
  const index = await s.getIndex();
  await s.updateIndex(addOrUpdateIndex(index, meta));
  cacheLog('negative set', namespace, key);
}

export async function removeFromResponseCache(
  namespace: string,
  key: string
): Promise<void> {
  const s = getStorage();
  await s.remove(namespace, key);
  const index = await s.getIndex();
  await s.updateIndex(removeFromIndex(index, namespace, key));
}

export async function clearResponseCacheNamespace(namespace: string): Promise<void> {
  const s = getStorage();
  const index = await s.getIndex();
  const remaining = index.filter((e) => e.namespace !== namespace);
  for (const e of index.filter((e) => e.namespace === namespace)) {
    await s.remove(e.namespace, e.key);
  }
  await s.updateIndex(remaining);
  cacheLog('cleared namespace', namespace);
}
