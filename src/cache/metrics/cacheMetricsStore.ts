/**
 * In-memory cache metrics store. Aggregates events, exposes snapshots.
 * Lifetime persistence is handled separately (cacheMetricsStore persistence module).
 */

import type {
  CacheMetricsCounters,
  CacheMetricsTiming,
  NamespaceMetrics,
  SourceMetrics,
  CacheMetricEventPayload,
} from './types';
import type { CacheMetricEventName } from './events';

const EMPTY_COUNTERS: CacheMetricsCounters = {
  totalReads: 0,
  totalWrites: 0,
  memoryHits: 0,
  persistentHits: 0,
  entityHits: 0,
  cacheMisses: 0,
  networkFetches: 0,
  requestsAvoidedFresh: 0,
  requestsAvoidedNegative: 0,
  requestsAvoidedBySourceHealth: 0,
  requestsDeduped: 0,
  entityPageReconstructions: 0,
  staleHits: 0,
  staleServedOnError: 0,
  staleServedWhileRateLimited: 0,
  backgroundRevalidationsStarted: 0,
  backgroundRevalidationsSucceeded: 0,
  backgroundRevalidationsFailed: 0,
  negativeCacheHits: 0,
  negativeWrites: 0,
  evictionsExpired: 0,
  evictionsBroken: 0,
  evictionsNamespaceLimit: 0,
  evictionsGlobalLimit: 0,
  sourceFailures: 0,
  sourceRateLimited: 0,
  sourceSuccesses: 0,
  deferredRefreshes: 0,
  legacyCacheMigrations: 0,
  legacyFallbackReads: 0,
};

const EMPTY_TIMING: CacheMetricsTiming = {
  totalMemoryReadMs: 0,
  totalPersistentReadMs: 0,
  totalEntityReadMs: 0,
  totalNetworkFetchMs: 0,
};

function emptyNamespace(): NamespaceMetrics {
  return {
    reads: 0,
    writes: 0,
    hits: 0,
    misses: 0,
    staleHits: 0,
    negativeHits: 0,
    deduped: 0,
    avoidedRequests: 0,
    revalidations: 0,
    networkFetches: 0,
    entityFallbacks: 0,
  };
}

function emptySource(): SourceMetrics {
  return {
    successes: 0,
    failures: 0,
    rateLimited: 0,
    staleFallbacks: 0,
    deferredRefreshes: 0,
    networkFetches: 0,
  };
}

const session: CacheMetricsCounters = { ...EMPTY_COUNTERS };
const lifetime: CacheMetricsCounters = { ...EMPTY_COUNTERS };
const sessionTiming: CacheMetricsTiming = { ...EMPTY_TIMING };
const lifetimeTiming: CacheMetricsTiming = { ...EMPTY_TIMING };
const namespaces: Record<string, NamespaceMetrics> = {};
const sources: Record<string, SourceMetrics> = {};

function ensureNamespace(ns: string): NamespaceMetrics {
  if (!namespaces[ns]) namespaces[ns] = { ...emptyNamespace() };
  return namespaces[ns];
}

function ensureSource(src: string): SourceMetrics {
  if (!sources[src]) sources[src] = { ...emptySource() };
  return sources[src];
}

function increment(
  target: CacheMetricsCounters,
  key: keyof CacheMetricsCounters,
  delta = 1
): void {
  (target[key] as number) += Math.max(0, delta);
}

export function recordCacheMetric(
  eventName: CacheMetricEventName,
  payload?: CacheMetricEventPayload
): void {
  const ns = payload?.namespace;
  const src = payload?.source;
  const dur = payload?.durationMs ?? 0;

  const isReadEvent =
    eventName === 'memory_hit' ||
    eventName === 'persistent_hit' ||
    eventName === 'entity_hit' ||
    eventName === 'cache_miss' ||
    eventName === 'stale_hit' ||
    eventName === 'negative_hit';

  if (isReadEvent) {
    increment(session, 'totalReads');
    increment(lifetime, 'totalReads');
  }

  switch (eventName) {
    case 'memory_hit':
      increment(session, 'memoryHits');
      increment(lifetime, 'memoryHits');
      sessionTiming.totalMemoryReadMs += dur;
      lifetimeTiming.totalMemoryReadMs += dur;
      if (ns) {
        const n = ensureNamespace(ns);
        n.reads++;
        n.hits++;
      }
      break;

    case 'persistent_hit':
      increment(session, 'persistentHits');
      increment(lifetime, 'persistentHits');
      sessionTiming.totalPersistentReadMs += dur;
      lifetimeTiming.totalPersistentReadMs += dur;
      if (ns) {
        const n = ensureNamespace(ns);
        n.reads++;
        n.hits++;
      }
      break;

    case 'entity_hit':
      increment(session, 'entityHits');
      increment(lifetime, 'entityHits');
      sessionTiming.totalEntityReadMs += dur;
      lifetimeTiming.totalEntityReadMs += dur;
      if (ns) {
        const n = ensureNamespace(ns);
        n.reads++;
        n.hits++;
      }
      break;

    case 'cache_miss':
      increment(session, 'cacheMisses');
      increment(lifetime, 'cacheMisses');
      if (ns) {
        ensureNamespace(ns).misses++;
      }
      break;

    case 'stale_hit':
      increment(session, 'staleHits');
      increment(lifetime, 'staleHits');
      if (ns) ensureNamespace(ns).staleHits++;
      break;

    case 'negative_hit':
      increment(session, 'negativeCacheHits');
      increment(lifetime, 'negativeCacheHits');
      if (ns) ensureNamespace(ns).negativeHits++;
      break;

    case 'cache_write':
      increment(session, 'totalWrites');
      increment(lifetime, 'totalWrites');
      if (ns) ensureNamespace(ns).writes++;
      break;

    case 'negative_write':
      increment(session, 'negativeWrites');
      increment(lifetime, 'negativeWrites');
      if (ns) ensureNamespace(ns).writes++;
      break;

    case 'revalidation_started':
      increment(session, 'backgroundRevalidationsStarted');
      increment(lifetime, 'backgroundRevalidationsStarted');
      if (ns) ensureNamespace(ns).revalidations++;
      break;

    case 'revalidation_success':
      increment(session, 'backgroundRevalidationsSucceeded');
      increment(lifetime, 'backgroundRevalidationsSucceeded');
      break;

    case 'revalidation_failure':
      increment(session, 'backgroundRevalidationsFailed');
      increment(lifetime, 'backgroundRevalidationsFailed');
      break;

    case 'network_fetch_started':
      increment(session, 'networkFetches');
      increment(lifetime, 'networkFetches');
      if (ns) ensureNamespace(ns).networkFetches++;
      if (src) ensureSource(src).networkFetches++;
      break;

    case 'network_fetch_success':
      if (dur > 0) {
        sessionTiming.totalNetworkFetchMs += dur;
        lifetimeTiming.totalNetworkFetchMs += dur;
      }
      break;

    case 'network_fetch_failure':
      break; // already counted as fetch_started

    case 'request_deduped':
      increment(session, 'requestsDeduped');
      increment(lifetime, 'requestsDeduped');
      if (ns) ensureNamespace(ns).deduped++;
      break;

    case 'request_avoided_fresh':
      increment(session, 'requestsAvoidedFresh');
      increment(lifetime, 'requestsAvoidedFresh');
      if (ns) ensureNamespace(ns).avoidedRequests++;
      break;

    case 'request_avoided_negative':
      increment(session, 'requestsAvoidedNegative');
      increment(lifetime, 'requestsAvoidedNegative');
      if (ns) ensureNamespace(ns).avoidedRequests++;
      break;

    case 'request_avoided_source_health':
      increment(session, 'requestsAvoidedBySourceHealth');
      increment(lifetime, 'requestsAvoidedBySourceHealth');
      if (src) ensureSource(src).staleFallbacks++;
      break;

    case 'stale_served_on_error':
      increment(session, 'staleServedOnError');
      increment(lifetime, 'staleServedOnError');
      if (src) ensureSource(src).staleFallbacks++;
      break;

    case 'stale_served_while_rate_limited':
      increment(session, 'staleServedWhileRateLimited');
      increment(lifetime, 'staleServedWhileRateLimited');
      if (src) ensureSource(src).staleFallbacks++;
      break;

    case 'refresh_deferred_source_health':
      increment(session, 'deferredRefreshes');
      increment(lifetime, 'deferredRefreshes');
      if (src) ensureSource(src).deferredRefreshes++;
      break;

    case 'episode_page_reconstructed_from_entities':
      increment(session, 'entityPageReconstructions');
      increment(lifetime, 'entityPageReconstructions');
      if (ns) ensureNamespace(ns).entityFallbacks++;
      break;

    case 'eviction_expired': {
      const de = payload?.delta ?? 1;
      increment(session, 'evictionsExpired', de);
      increment(lifetime, 'evictionsExpired', de);
      break;
    }

    case 'eviction_broken': {
      const db = payload?.delta ?? 1;
      increment(session, 'evictionsBroken', db);
      increment(lifetime, 'evictionsBroken', db);
      break;
    }

    case 'eviction_namespace_limit': {
      const dn = payload?.delta ?? 1;
      increment(session, 'evictionsNamespaceLimit', dn);
      increment(lifetime, 'evictionsNamespaceLimit', dn);
      break;
    }

    case 'eviction_global_limit': {
      const dg = payload?.delta ?? 1;
      increment(session, 'evictionsGlobalLimit', dg);
      increment(lifetime, 'evictionsGlobalLimit', dg);
      break;
    }

    case 'source_success':
      increment(session, 'sourceSuccesses');
      increment(lifetime, 'sourceSuccesses');
      if (src) ensureSource(src).successes++;
      break;

    case 'source_failure':
      increment(session, 'sourceFailures');
      increment(lifetime, 'sourceFailures');
      if (src) ensureSource(src).failures++;
      break;

    case 'source_rate_limited':
      increment(session, 'sourceRateLimited');
      increment(lifetime, 'sourceRateLimited');
      if (src) ensureSource(src).rateLimited++;
      break;

    case 'legacy_cache_migrated': {
      const dm = payload?.delta ?? 1;
      increment(session, 'legacyCacheMigrations', dm);
      increment(lifetime, 'legacyCacheMigrations', dm);
      break;
    }

    case 'legacy_cache_fallback_used':
      increment(session, 'legacyFallbackReads');
      increment(lifetime, 'legacyFallbackReads');
      break;

    default:
      break;
  }
}

export function getCacheMetricsSnapshot(): {
  session: CacheMetricsCounters;
  lifetime: CacheMetricsCounters;
  sessionTiming: CacheMetricsTiming;
  lifetimeTiming: CacheMetricsTiming;
  namespaces: Record<string, NamespaceMetrics>;
  sources: Record<string, SourceMetrics>;
  lastUpdated: number;
} {
  return {
    session: { ...session },
    lifetime: { ...lifetime },
    sessionTiming: { ...sessionTiming },
    lifetimeTiming: { ...lifetimeTiming },
    namespaces: JSON.parse(JSON.stringify(namespaces)),
    sources: JSON.parse(JSON.stringify(sources)),
    lastUpdated: Date.now(),
  };
}

export function resetSessionMetrics(): void {
  Object.assign(session, EMPTY_COUNTERS);
  Object.assign(sessionTiming, EMPTY_TIMING);
  for (const k of Object.keys(namespaces)) {
    Object.assign(namespaces[k], emptyNamespace());
  }
  for (const k of Object.keys(sources)) {
    Object.assign(sources[k], emptySource());
  }
}

export function resetLifetimeMetrics(): void {
  Object.assign(lifetime, EMPTY_COUNTERS);
  Object.assign(lifetimeTiming, EMPTY_TIMING);
}

export function getLifetimeForPersistence(): {
  lifetime: CacheMetricsCounters;
  lifetimeTiming: CacheMetricsTiming;
  namespaces: Record<string, NamespaceMetrics>;
  sources: Record<string, SourceMetrics>;
} {
  return {
    lifetime: { ...lifetime },
    lifetimeTiming: { ...lifetimeTiming },
    namespaces: JSON.parse(JSON.stringify(namespaces)),
    sources: JSON.parse(JSON.stringify(sources)),
  };
}

export function hydrateLifetimeFromPersistence(data: {
  lifetime: CacheMetricsCounters;
  lifetimeTiming: CacheMetricsTiming;
  namespaces: Record<string, NamespaceMetrics>;
  sources: Record<string, SourceMetrics>;
}): void {
  Object.assign(lifetime, data.lifetime);
  Object.assign(lifetimeTiming, data.lifetimeTiming);
  Object.assign(namespaces, data.namespaces);
  Object.assign(sources, data.sources);
}
