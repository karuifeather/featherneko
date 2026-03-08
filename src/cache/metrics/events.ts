/**
 * Central event names for cache metrics instrumentation.
 */

export const CACHE_METRIC_EVENTS = {
  memory_hit: 'memory_hit',
  persistent_hit: 'persistent_hit',
  entity_hit: 'entity_hit',
  cache_miss: 'cache_miss',
  stale_hit: 'stale_hit',
  negative_hit: 'negative_hit',

  cache_write: 'cache_write',
  negative_write: 'negative_write',
  revalidation_started: 'revalidation_started',
  revalidation_success: 'revalidation_success',
  revalidation_failure: 'revalidation_failure',

  network_fetch_started: 'network_fetch_started',
  network_fetch_success: 'network_fetch_success',
  network_fetch_failure: 'network_fetch_failure',
  request_deduped: 'request_deduped',
  request_avoided_fresh: 'request_avoided_fresh',
  request_avoided_negative: 'request_avoided_negative',
  request_avoided_source_health: 'request_avoided_source_health',

  stale_served_on_error: 'stale_served_on_error',
  stale_served_while_rate_limited: 'stale_served_while_rate_limited',
  refresh_deferred_source_health: 'refresh_deferred_source_health',

  episode_page_reconstructed_from_entities: 'episode_page_reconstructed_from_entities',

  eviction_expired: 'eviction_expired',
  eviction_broken: 'eviction_broken',
  eviction_namespace_limit: 'eviction_namespace_limit',
  eviction_global_limit: 'eviction_global_limit',

  source_success: 'source_success',
  source_failure: 'source_failure',
  source_rate_limited: 'source_rate_limited',

  legacy_cache_migrated: 'legacy_cache_migrated',
  legacy_cache_fallback_used: 'legacy_cache_fallback_used',
} as const;

export type CacheMetricEventName = (typeof CACHE_METRIC_EVENTS)[keyof typeof CACHE_METRIC_EVENTS];
