/**
 * Persistent storage for lifetime cache metrics. Debounced writes.
 * Reset cancels pending debounced writes to prevent stale data overwriting a reset.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getLifetimeForPersistence,
  hydrateLifetimeFromPersistence,
  resetLifetimeMetrics,
  resetSessionMetrics,
} from './cacheMetricsStore';
import type { CacheMetricsCounters, CacheMetricsTiming, NamespaceMetrics, SourceMetrics } from './types';

const STORAGE_KEY = 'featherneko_cache_metrics_v1';
const DEBOUNCE_MS = 3000;
export const METRICS_SCHEMA_VERSION = 1;

let flushTimer: ReturnType<typeof setTimeout> | null = null;

export interface PersistedMetrics {
  version: number;
  lifetime: CacheMetricsCounters;
  lifetimeTiming: CacheMetricsTiming;
  namespaces: Record<string, NamespaceMetrics>;
  sources: Record<string, SourceMetrics>;
  savedAt: number;
}

export async function loadPersistedMetrics(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as PersistedMetrics;
    if (data?.version !== METRICS_SCHEMA_VERSION || !data.lifetime) return;
    hydrateLifetimeFromPersistence({
      lifetime: data.lifetime,
      lifetimeTiming: data.lifetimeTiming ?? { totalMemoryReadMs: 0, totalPersistentReadMs: 0, totalEntityReadMs: 0, totalNetworkFetchMs: 0 },
      namespaces: data.namespaces ?? {},
      sources: data.sources ?? {},
    });
  } catch {
    /* ignore */
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    try {
      const data = getLifetimeForPersistence();
      const payload: PersistedMetrics = {
        version: METRICS_SCHEMA_VERSION,
        lifetime: data.lifetime,
        lifetimeTiming: data.lifetimeTiming,
        namespaces: data.namespaces,
        sources: data.sources,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, DEBOUNCE_MS);
}

/** Cancel any pending debounced write. Call before reset to avoid stale overwrite. */
export function cancelPendingFlush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/** Call after recording metrics to schedule a debounced persist. */
export function scheduleMetricsFlush(): void {
  scheduleFlush();
}

export async function persistMetricsNow(): Promise<void> {
  cancelPendingFlush();
  try {
    const data = getLifetimeForPersistence();
    const payload: PersistedMetrics = {
      version: METRICS_SCHEMA_VERSION,
      lifetime: data.lifetime,
      lifetimeTiming: data.lifetimeTiming,
      namespaces: data.namespaces,
      sources: data.sources,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export async function clearPersistedMetrics(): Promise<void> {
  cancelPendingFlush();
  resetSessionMetrics();
  resetLifetimeMetrics();
  await AsyncStorage.removeItem(STORAGE_KEY);
}
