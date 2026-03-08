/**
 * React hook for cache metrics. Returns a snapshot and refresh callback.
 */

import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getCacheMetricsSnapshot, type CacheMetricsSnapshot } from './cacheMetrics';

export function useCacheMetrics(): {
  snapshot: CacheMetricsSnapshot | null;
  refresh: () => void;
  isLoading: boolean;
} {
  const [snapshot, setSnapshot] = useState<CacheMetricsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setSnapshot(getCacheMetricsSnapshot());
    } catch {
      setSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { snapshot, refresh, isLoading };
}
