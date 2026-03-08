/**
 * In-flight request deduplication. Multiple callers for the same key get one Promise.
 */

import { recordCacheMetric } from '../metrics';

const inflight = new Map<string, Promise<unknown>>();

export function coalesce<T>(
  namespace: string,
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const k = `${namespace}:${key}`;
  const existing = inflight.get(k);
  if (existing) {
    recordCacheMetric('request_deduped', { namespace });
    return existing as Promise<T>;
  }

  const promise = fetcher().finally(() => {
    inflight.delete(k);
  });
  inflight.set(k, promise);
  return promise;
}

export function clearCoalescer(): void {
  inflight.clear();
}
