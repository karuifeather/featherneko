/**
 * Central cache status evaluator. Classifies entries as fresh, stale, expired, etc.
 */

import type { CacheEntryMeta, CacheStatus } from '../types';
import { now } from './clock';

export function evaluateCacheStatus(meta: CacheEntryMeta | null, rawData: unknown): CacheStatus {
  if (!meta || rawData === undefined) return 'broken';

  if (meta.negative) {
    const hard = meta.hardExpiresAt ?? 0;
    if (now() <= hard) return 'negative';
    return 'expired';
  }

  if (meta.immutable) return 'immutable';

  const n = now();
  const soft = meta.softExpiresAt ?? 0;
  const hard = meta.hardExpiresAt ?? 0;

  if (n <= soft) return 'fresh';
  if (n <= hard) return 'stale';
  return 'expired';
}
