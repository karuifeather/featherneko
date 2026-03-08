/**
 * Central cache service. Orchestrates memory + persistent layers, SWR, coalescing.
 */

import type { CacheContext, CacheReadResult, CacheEntryMeta } from './types';
import { MemoryCache } from './memory/memoryCache';
import {
  getFromResponseCache,
  setToResponseCache,
  setNegativeToResponseCache,
  removeFromResponseCache,
  clearResponseCacheNamespace,
} from './persistent/responseCache';
import { resolvePolicy } from './policyEngine';
import { evaluateCacheStatus } from './utils/cacheStatus';
import { now } from './utils/clock';
import { coalesce } from './revalidation/requestCoalescer';
import { markRevalidating, unmarkRevalidating } from './revalidation/revalidator';
import { getSourceHealth } from './source/sourceHealth';
import { cacheLog } from './utils/logger';
import { recordCacheMetric } from './metrics';

const memory = new MemoryCache(500);

function updateAccessMeta(meta: CacheEntryMeta): CacheEntryMeta {
  return {
    ...meta,
    lastAccessedAt: now(),
    accessCount: meta.accessCount + 1,
  };
}

export async function get<T>(
  namespace: string,
  key: string,
  context?: CacheContext | null
): Promise<CacheReadResult<T>> {
  const policy = resolvePolicy(namespace, context);
  const ctxWithHealth = {
    ...context,
    sourceHealth: policy.source ? getSourceHealth(policy.source) : undefined,
  };

  if (policy.memoryEnabled) {
    const memEntry = memory.get(namespace, key);
    if (memEntry) {
      const status = evaluateCacheStatus(memEntry.meta, memEntry.data);
      const shouldRevalidate =
        status === 'stale' &&
        policy.revalidationMode === 'background' &&
        policy.source &&
        getSourceHealth(policy.source) !== 'rate_limited';

      memory.set({
        ...memEntry,
        meta: updateAccessMeta(memEntry.meta),
      });

      recordCacheMetric('memory_hit', { namespace, source: policy.source });
      if (status === 'stale') recordCacheMetric('stale_hit', { namespace });
      cacheLog('hit', status, namespace, key, shouldRevalidate ? '-> background revalidate' : '');
      return {
        hit: true,
        status,
        data: memEntry.data as T | null,
        meta: memEntry.meta,
        shouldRevalidate,
      };
    }
  }

  const t0 = now();
  const { entry, status } = await getFromResponseCache<T>(namespace, key, context);
  const dur = now() - t0;
  if (!entry) {
    if (status === 'negative') {
      recordCacheMetric('negative_hit', { namespace });
      return { hit: true, status: 'negative', data: null, meta: undefined, shouldRevalidate: false };
    }
    recordCacheMetric('cache_miss', { namespace });
    cacheLog('miss', namespace, key);
    return { hit: false, status: 'broken', data: null, shouldRevalidate: false };
  }

  const effectiveStatus = evaluateCacheStatus(entry.meta, entry.data);
  const shouldRevalidate =
    (effectiveStatus === 'stale' || effectiveStatus === 'expired') &&
    policy.revalidationMode === 'background' &&
    (!policy.source || getSourceHealth(policy.source) !== 'rate_limited');

  if (policy.memoryEnabled) {
    memory.set({
      ...entry,
      meta: updateAccessMeta(entry.meta),
    } as import('./types').CacheEntry<unknown>);
  }

  recordCacheMetric('persistent_hit', { namespace, source: policy.source, durationMs: dur });
  if (effectiveStatus === 'stale') recordCacheMetric('stale_hit', { namespace });
  cacheLog(
    'hit',
    effectiveStatus,
    namespace,
    key,
    shouldRevalidate ? '-> background revalidate' : ''
  );

  return {
    hit: true,
    status: effectiveStatus,
    data: entry.data as T | null,
    meta: entry.meta,
    shouldRevalidate,
  };
}

export async function set<T>(
  namespace: string,
  key: string,
  data: T,
  context?: CacheContext | null,
  overrides?: Partial<CacheEntryMeta>
): Promise<void> {
  recordCacheMetric('cache_write', { namespace });
  await setToResponseCache(namespace, key, data, context, overrides);
  const policy = resolvePolicy(namespace, context);
  if (policy.memoryEnabled) {
    const { entry } = await getFromResponseCache<T>(namespace, key, context);
    if (entry) memory.set(entry as import('./types').CacheEntry<unknown>);
  }
}

export async function setNegative(
  namespace: string,
  key: string,
  reason?: string,
  context?: CacheContext | null
): Promise<void> {
  recordCacheMetric('negative_write', { namespace });
  await setNegativeToResponseCache(namespace, key, reason, context);
  memory.remove(namespace, key);
}

export async function remove(namespace: string, key: string): Promise<void> {
  memory.remove(namespace, key);
  await removeFromResponseCache(namespace, key);
}

export async function clearNamespace(namespace: string): Promise<void> {
  memory.clearNamespace(namespace);
  await clearResponseCacheNamespace(namespace);
}

export async function clearAllCaches(): Promise<void> {
  memory.clear();
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const { META_INDEX_KEY, ENTRY_PREFIX } = await import('./keys');
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter((k) => k === META_INDEX_KEY || k.startsWith(ENTRY_PREFIX + ':'));
  if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  cacheLog('cleared all');
}

export async function getOrFetch<T>(
  namespace: string,
  key: string,
  fetcher: () => Promise<T>,
  context?: CacheContext | null
): Promise<T> {
  return coalesce(namespace, key, async () => {
    const policy = resolvePolicy(namespace, context);
    const sourceHealth = policy.source ? getSourceHealth(policy.source) : 'healthy';

    const result = await get<T>(namespace, key, context);

    if (result.hit && result.data != null && result.status !== 'expired') {
      if (!result.shouldRevalidate) {
        if (result.status === 'stale' && sourceHealth === 'rate_limited') {
          recordCacheMetric('refresh_deferred_source_health', { namespace, source: policy.source });
        } else {
          recordCacheMetric('request_avoided_fresh', { namespace, source: policy.source });
        }
      } else {
        recordCacheMetric('revalidation_started', { namespace });
        revalidate(namespace, key, fetcher, context).catch(() => {});
      }
      return result.data;
    }

    if (
      result.hit &&
      (result.status === 'stale' || result.status === 'negative') &&
      sourceHealth === 'rate_limited' &&
      policy.allowStaleOnError
    ) {
      if (result.status === 'stale' && result.data != null) {
        recordCacheMetric('stale_served_while_rate_limited', { namespace, source: policy.source });
        recordCacheMetric('request_avoided_source_health', { namespace, source: policy.source });
        return result.data;
      }
    }

    try {
      recordCacheMetric('network_fetch_started', { namespace, source: policy.source });
      const t0 = now();
      const data = await fetcher();
      recordCacheMetric('network_fetch_success', { durationMs: now() - t0 });
      await set(namespace, key, data, context);
      return data;
    } catch (e) {
      if (
        result.hit &&
        result.status === 'stale' &&
        result.data != null &&
        policy.allowStaleOnError
      ) {
        recordCacheMetric('stale_served_on_error', { namespace, source: policy.source });
        return result.data;
      }
      throw e;
    }
  });
}

export async function revalidate<T>(
  namespace: string,
  key: string,
  fetcher: () => Promise<T>,
  context?: CacheContext | null
): Promise<T | null> {
  if (!markRevalidating(namespace, key)) return null;

  try {
    const data = await fetcher();
    await set(namespace, key, data, context);
    recordCacheMetric('revalidation_success', { namespace });
    cacheLog('revalidate success', namespace, key);
    return data;
  } catch (e) {
    recordCacheMetric('revalidation_failure', { namespace });
    cacheLog('revalidate failed', namespace, key, (e as Error)?.message);
    return null;
  } finally {
    unmarkRevalidating(namespace, key);
  }
}
