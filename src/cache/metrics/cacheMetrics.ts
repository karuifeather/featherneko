/**
 * Central API for cache metrics. Use recordCacheMetric to instrument; use hooks/snapshots for UI.
 */

import type { CacheMetricEventPayload } from './types';
import type { CacheMetricEventName } from './events';
import { recordCacheMetric as storeRecord } from './cacheMetricsStore';
import { scheduleMetricsFlush } from './cacheMetricsPersistence';
import {
  getCacheMetricsSnapshot as getSnapshot,
  resetSessionMetrics as resetSession,
  resetLifetimeMetrics as resetLifetime,
} from './cacheMetricsStore';
import {
  loadPersistedMetrics,
  persistMetricsNow,
  clearPersistedMetrics,
} from './cacheMetricsPersistence';

/** Record a cache metric event. Lightweight; does not block. */
export function recordCacheMetric(
  eventName: CacheMetricEventName,
  payload?: CacheMetricEventPayload
): void {
  try {
    storeRecord(eventName, payload);
    scheduleMetricsFlush();
  } catch {
    /* metrics must not break the app */
  }
}

/** Get a snapshot of all metrics for UI. */
export function getCacheMetricsSnapshot() {
  return getSnapshot();
}

/** Reset session metrics only (in-memory). */
export function resetSessionMetrics(): void {
  resetSession();
}

/** Reset all metrics (session + lifetime + persisted). Cancels pending debounced writes first. */
export async function resetCacheMetrics(): Promise<void> {
  await clearPersistedMetrics();
}

/** Initialize metrics on app startup: load persisted lifetime data. */
export async function initCacheMetrics(): Promise<void> {
  await loadPersistedMetrics();
}

/** Force flush metrics to storage. */
export async function flushCacheMetrics(): Promise<void> {
  await persistMetricsNow();
}

export {
  loadPersistedMetrics,
  persistMetricsNow,
  clearPersistedMetrics,
};
export type { CacheMetricsSnapshot, CacheMetricsCounters } from './types';
