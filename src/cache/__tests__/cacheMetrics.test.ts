/**
 * Tests for the cache metrics subsystem.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  recordCacheMetric,
  getCacheMetricsSnapshot,
  resetSessionMetrics,
  resetCacheMetrics,
  clearPersistedMetrics,
} from '../metrics';
import { loadPersistedMetrics } from '../metrics/cacheMetricsPersistence';
import {
  getLifetimeForPersistence,
  hydrateLifetimeFromPersistence,
  resetLifetimeMetrics,
} from '../metrics/cacheMetricsStore';
import { buildCacheInsightsViewModel } from '../metrics/buildCacheInsightsViewModel';

describe('cache metrics', () => {
  beforeEach(async () => {
    resetSessionMetrics();
    resetLifetimeMetrics();
    await clearPersistedMetrics();
  });

  describe('collection', () => {
    it('memory hit increments correct counters', () => {
      recordCacheMetric('memory_hit', { namespace: 'HOME_FEED' });
      const s = getCacheMetricsSnapshot();
      expect(s.session.memoryHits).toBe(1);
      expect(s.session.totalReads).toBe(1);
    });

    it('persistent hit increments correct counters', () => {
      recordCacheMetric('persistent_hit', { namespace: 'KITSU_EPISODES_PAGE' });
      const s = getCacheMetricsSnapshot();
      expect(s.session.persistentHits).toBe(1);
      expect(s.session.totalReads).toBe(1);
    });

    it('entity hit increments correct counters', () => {
      recordCacheMetric('entity_hit', { namespace: 'ANIME_MEDIA_STABLE' });
      const s = getCacheMetricsSnapshot();
      expect(s.session.entityHits).toBe(1);
      expect(s.session.totalReads).toBe(1);
    });

    it('cache miss increments correct counters', () => {
      recordCacheMetric('cache_miss', { namespace: 'STREAMING_SERIES' });
      const s = getCacheMetricsSnapshot();
      expect(s.session.cacheMisses).toBe(1);
      expect(s.session.totalReads).toBe(1);
    });

    it('negative hit increments correct counters', () => {
      recordCacheMetric('negative_hit', { namespace: 'SLUG_RESOLUTION' });
      const s = getCacheMetricsSnapshot();
      expect(s.session.negativeCacheHits).toBe(1);
      expect(s.session.totalReads).toBe(1);
    });

    it('stale served on error increments correct counters', () => {
      recordCacheMetric('stale_served_on_error', { namespace: 'ANILIST_FEED', source: 'anilist' });
      const s = getCacheMetricsSnapshot();
      expect(s.session.staleServedOnError).toBe(1);
    });

    it('request deduped increments correct counters', () => {
      recordCacheMetric('request_deduped', { namespace: 'HOME_FEED' });
      const s = getCacheMetricsSnapshot();
      expect(s.session.requestsDeduped).toBe(1);
    });

    it('episode page reconstructed increments correct counters', () => {
      recordCacheMetric('episode_page_reconstructed_from_entities', {
        namespace: 'KITSU_EPISODES_PAGE',
      });
      const s = getCacheMetricsSnapshot();
      expect(s.session.entityPageReconstructions).toBe(1);
    });

    it('eviction with delta increments correctly', () => {
      recordCacheMetric('eviction_expired', { delta: 5 });
      const s = getCacheMetricsSnapshot();
      expect(s.session.evictionsExpired).toBe(5);
    });

    it('refresh_deferred_source_health increments correct counters', () => {
      recordCacheMetric('refresh_deferred_source_health', { namespace: 'HOME_FEED', source: 'anilist' });
      const s = getCacheMetricsSnapshot();
      expect(s.session.deferredRefreshes).toBe(1);
    });

    it('legacy_cache_fallback_used increments correct counters', () => {
      recordCacheMetric('legacy_cache_fallback_used', {});
      const s = getCacheMetricsSnapshot();
      expect(s.session.legacyFallbackReads).toBe(1);
    });

    it('eviction_broken increments correct counters', () => {
      recordCacheMetric('eviction_broken', { delta: 2 });
      const s = getCacheMetricsSnapshot();
      expect(s.session.evictionsBroken).toBe(2);
    });
  });

  describe('persistence', () => {
    it('lifetime metrics persist and reload correctly', () => {
      recordCacheMetric('memory_hit', { namespace: 'HOME_FEED' });
      recordCacheMetric('cache_write', { namespace: 'HOME_FEED' });
      const data = getLifetimeForPersistence();
      hydrateLifetimeFromPersistence(data);
      resetSessionMetrics();
      const s = getCacheMetricsSnapshot();
      expect(s.lifetime.memoryHits).toBe(1);
      expect(s.lifetime.totalWrites).toBe(1);
    });

    it('session metrics reset on reset', () => {
      recordCacheMetric('memory_hit', { namespace: 'HOME_FEED' });
      resetSessionMetrics();
      const s = getCacheMetricsSnapshot();
      expect(s.session.memoryHits).toBe(0);
    });

    it('resetCacheMetrics clears stored metrics', async () => {
      recordCacheMetric('memory_hit', { namespace: 'HOME_FEED' });
      await resetCacheMetrics();
      const s = getCacheMetricsSnapshot();
      expect(s.session.memoryHits).toBe(0);
      expect(s.lifetime.memoryHits).toBe(0);
    });
  });

  describe('derived metrics', () => {
    it('hit rate calculation is correct', () => {
      recordCacheMetric('memory_hit', { namespace: 'HOME_FEED' });
      recordCacheMetric('memory_hit', { namespace: 'HOME_FEED' });
      recordCacheMetric('cache_miss', { namespace: 'HOME_FEED' });
      const vm = buildCacheInsightsViewModel(getCacheMetricsSnapshot());
      expect(vm.totalReads).toBeGreaterThanOrEqual(3);
      expect(vm.cacheHitRate).toBeGreaterThan(0);
      expect(vm.cacheHitRate).toBeLessThanOrEqual(1);
    });

    it('requests avoided calculation aggregates correctly', () => {
      recordCacheMetric('request_avoided_fresh', { namespace: 'ANILIST_FEED' });
      recordCacheMetric('request_deduped', { namespace: 'HOME_FEED' });
      recordCacheMetric('episode_page_reconstructed_from_entities', {
        namespace: 'KITSU_EPISODES_PAGE',
      });
      const vm = buildCacheInsightsViewModel(getCacheMetricsSnapshot());
      expect(vm.requestsAvoidedTotal).toBeGreaterThanOrEqual(3);
    });

    it('top namespaces sorting works', () => {
      recordCacheMetric('memory_hit', { namespace: 'HOME_FEED' });
      recordCacheMetric('request_avoided_fresh', { namespace: 'STREAMING_SERIES' });
      recordCacheMetric('request_avoided_fresh', { namespace: 'STREAMING_SERIES' });
      const vm = buildCacheInsightsViewModel(getCacheMetricsSnapshot());
      expect(vm.topNamespaces.length).toBeGreaterThanOrEqual(2);
      const top = vm.topNamespaces[0];
      expect(top.namespace).toBe('STREAMING_SERIES');
      expect(top.avoidedRequests).toBe(2);
    });

    it('estimated time saved never goes negative', () => {
      recordCacheMetric('request_avoided_fresh', { namespace: 'HOME_FEED' });
      const vm = buildCacheInsightsViewModel(getCacheMetricsSnapshot());
      expect(vm.estimatedSavedMs).toBeGreaterThanOrEqual(0);
    });

    it('recoveredDuringSourceIssues aggregates correctly', () => {
      recordCacheMetric('stale_served_on_error', { source: 'anilist' });
      recordCacheMetric('stale_served_while_rate_limited', { source: 'kitsu' });
      recordCacheMetric('refresh_deferred_source_health', { source: 'anilist' });
      const vm = buildCacheInsightsViewModel(getCacheMetricsSnapshot(), 'session');
      expect(vm.recoveredDuringSourceIssues).toBe(3);
    });

    it('session vs lifetime switching changes view model', () => {
      recordCacheMetric('memory_hit', { namespace: 'HOME_FEED' });
      const snapshot = getCacheMetricsSnapshot();
      const vmSession = buildCacheInsightsViewModel(snapshot, 'session');
      const vmLifetime = buildCacheInsightsViewModel(snapshot, 'lifetime');
      expect(vmSession.timeWindow).toBe('session');
      expect(vmLifetime.timeWindow).toBe('lifetime');
    });

    it('zero-state view model has hasData false', () => {
      const vm = buildCacheInsightsViewModel(null);
      expect(vm.hasData).toBe(false);
      expect(vm.totalReads).toBe(0);
      expect(vm.requestsAvoidedTotal).toBe(0);
    });
  });

  describe('persistence hardening', () => {
    it('malformed stored metrics fail safely', async () => {
      await AsyncStorage.setItem('featherneko_cache_metrics_v1', 'invalid json');
      await loadPersistedMetrics();
      const s = getCacheMetricsSnapshot();
      expect(s.lifetime.totalReads).toBe(0);
    });
  });
});
