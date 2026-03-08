/**
 * Source health tracking. Tracks failures, 429s, cooldown.
 */

import type { CacheSource, SourceHealth } from '../types';

interface SourceState {
  failures: number;
  lastFailure: number;
  lastSuccess: number;
  rateLimitedUntil: number;
}

const states = new Map<CacheSource, SourceState>();

const WINDOW_MS = 60 * 1000;
const FAIL_THRESHOLD = 3;

function getState(source: CacheSource): SourceState {
  let s = states.get(source);
  if (!s) {
    s = { failures: 0, lastFailure: 0, lastSuccess: 0, rateLimitedUntil: 0 };
    states.set(source, s);
  }
  return s;
}

export function markSuccess(source: CacheSource): void {
  const s = getState(source);
  s.failures = 0;
  s.lastSuccess = Date.now();
}

export function markFailure(source: CacheSource, _error?: unknown): void {
  const s = getState(source);
  s.failures++;
  s.lastFailure = Date.now();
}

export function markRateLimited(source: CacheSource, retryAfterMs?: number): void {
  const s = getState(source);
  s.rateLimitedUntil = Date.now() + (retryAfterMs ?? 5 * 60 * 1000);
}

export function getSourceHealth(source: CacheSource): SourceHealth {
  const s = getState(source);
  const now = Date.now();
  if (now < s.rateLimitedUntil) return 'rate_limited';
  if (s.failures >= FAIL_THRESHOLD && now - s.lastFailure < WINDOW_MS) return 'degraded';
  return 'healthy';
}
