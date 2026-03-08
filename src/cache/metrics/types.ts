/**
 * Types for the cache observability / metrics subsystem.
 */

import type { CacheSource } from '../types';

/** Per-namespace aggregations */
export interface NamespaceMetrics {
  reads: number;
  writes: number;
  hits: number;
  misses: number;
  staleHits: number;
  negativeHits: number;
  deduped: number;
  avoidedRequests: number;
  revalidations: number;
  networkFetches: number;
  entityFallbacks: number;
}

/** Per-source aggregations */
export interface SourceMetrics {
  successes: number;
  failures: number;
  rateLimited: number;
  staleFallbacks: number;
  deferredRefreshes: number;
  networkFetches: number;
}

/** Aggregate counters (session or lifetime) */
export interface CacheMetricsCounters {
  totalReads: number;
  totalWrites: number;
  memoryHits: number;
  persistentHits: number;
  entityHits: number;
  cacheMisses: number;
  networkFetches: number;
  requestsAvoidedFresh: number;
  requestsAvoidedNegative: number;
  requestsAvoidedBySourceHealth: number;
  requestsDeduped: number;
  entityPageReconstructions: number;
  staleHits: number;
  staleServedOnError: number;
  staleServedWhileRateLimited: number;
  backgroundRevalidationsStarted: number;
  backgroundRevalidationsSucceeded: number;
  backgroundRevalidationsFailed: number;
  negativeCacheHits: number;
  negativeWrites: number;
  evictionsExpired: number;
  evictionsBroken: number;
  evictionsNamespaceLimit: number;
  evictionsGlobalLimit: number;
  sourceFailures: number;
  sourceRateLimited: number;
  sourceSuccesses: number;
  deferredRefreshes: number;
  legacyCacheMigrations: number;
  legacyFallbackReads: number;
}

/** Timing totals (rolling) */
export interface CacheMetricsTiming {
  totalMemoryReadMs: number;
  totalPersistentReadMs: number;
  totalEntityReadMs: number;
  totalNetworkFetchMs: number;
}

/** Full metrics snapshot */
export interface CacheMetricsSnapshot {
  session: CacheMetricsCounters;
  lifetime: CacheMetricsCounters;
  sessionTiming: CacheMetricsTiming;
  lifetimeTiming: CacheMetricsTiming;
  namespaces: Record<string, NamespaceMetrics>;
  sources: Record<string, SourceMetrics>;
  lastUpdated: number;
}

/** Event payloads for recording */
export interface CacheMetricEventPayload {
  namespace?: string;
  source?: CacheSource;
  durationMs?: number;
  key?: string;
  /** Optional delta for count events (default 1) */
  delta?: number;
}
