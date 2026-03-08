/**
 * Tests for policy engine resolution.
 */

import { resolvePolicy } from '../policyEngine';

describe('resolvePolicy', () => {
  it('resolves HOME_FEED with fixed TTLs', () => {
    const p = resolvePolicy('HOME_FEED');
    expect(p.namespace).toBe('HOME_FEED');
    expect(p.effectiveSoftTtlMs).toBe(30 * 60 * 1000);
    expect(p.effectiveHardTtlMs).toBe(24 * 60 * 60 * 1000);
  });

  it('resolves ANILIST_RECOMMENDATIONS with longer TTL for finished anime', () => {
    const finished = resolvePolicy('ANILIST_RECOMMENDATIONS', { isCompletedSeries: true });
    const airing = resolvePolicy('ANILIST_RECOMMENDATIONS', { isAiringSeries: true });
    expect(finished.effectiveSoftTtlMs).toBeGreaterThan(airing.effectiveSoftTtlMs);
  });

  it('returns default policy for unknown namespace', () => {
    const p = resolvePolicy('UNKNOWN_NS');
    expect(p.namespace).toBe('UNKNOWN_NS');
    expect(p.effectiveSoftTtlMs).toBeDefined();
    expect(p.effectiveHardTtlMs).toBeDefined();
  });
});
