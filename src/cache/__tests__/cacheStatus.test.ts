/**
 * Tests for cache status classification logic.
 */

import { evaluateCacheStatus } from '../utils/cacheStatus';
import type { CacheEntryMeta } from '../types';

const now = Date.now();

function meta(overrides: Partial<CacheEntryMeta>): CacheEntryMeta {
  return {
    namespace: 'TEST',
    key: 'k',
    version: 1,
    createdAt: now,
    updatedAt: now,
    fetchedAt: now,
    lastAccessedAt: now,
    accessCount: 0,
    ...overrides,
  };
}

describe('evaluateCacheStatus', () => {
  it('returns broken for null meta', () => {
    expect(evaluateCacheStatus(null, {})).toBe('broken');
  });

  it('returns broken for undefined data with non-negative meta', () => {
    expect(evaluateCacheStatus(meta({}), undefined)).toBe('broken');
  });

  it('returns immutable for immutable entries', () => {
    expect(evaluateCacheStatus(meta({ immutable: true }), { data: 1 })).toBe('immutable');
  });

  it('returns fresh when now <= softExpiresAt', () => {
    const m = meta({ softExpiresAt: now + 1000, hardExpiresAt: now + 2000 });
    expect(evaluateCacheStatus(m, {})).toBe('fresh');
  });

  it('returns stale when soft expired but now <= hardExpiresAt', () => {
    const m = meta({ softExpiresAt: now - 1000, hardExpiresAt: now + 1000 });
    expect(evaluateCacheStatus(m, {})).toBe('stale');
  });

  it('returns expired when now > hardExpiresAt', () => {
    const m = meta({ softExpiresAt: now - 2000, hardExpiresAt: now - 1000 });
    expect(evaluateCacheStatus(m, {})).toBe('expired');
  });

  it('returns negative when negative and within hard window', () => {
    const m = meta({ negative: true, hardExpiresAt: now + 1000 });
    expect(evaluateCacheStatus(m, null)).toBe('negative');
  });

  it('returns expired when negative and past hard window', () => {
    const m = meta({ negative: true, hardExpiresAt: now - 1000 });
    expect(evaluateCacheStatus(m, null)).toBe('expired');
  });
});
