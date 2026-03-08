/**
 * Policy engine: resolves effective cache policy by namespace and context.
 */

import type { CacheContext, CachePolicy, ResolvedCachePolicy } from './types';
import { POLICIES } from './policies';

const MS = { day: 24 * 60 * 60 * 1000 };

export function resolvePolicy(
  namespace: string,
  context?: CacheContext | null
): ResolvedCachePolicy {
  const base = POLICIES[namespace];
  const policy: CachePolicy = base ?? {
    namespace,
    storageTier: 'persistent',
    memoryEnabled: true,
    softTtlMs: 60 * 60 * 1000,
    hardTtlMs: 24 * 60 * 60 * 1000,
    revalidationMode: 'background',
    allowStaleOnError: true,
    priority: 'normal',
  };

  const isFinished = context?.isCompletedSeries ?? context?.animeStatus === 'FINISHED';
  const isAiring = context?.isAiringSeries ?? context?.animeStatus === 'RELEASING';
  const isFrontier = context?.isFrontierPage ?? false;

  let effectiveSoft = policy.softTtlMs ?? 60 * 60 * 1000;
  let effectiveHard = policy.hardTtlMs ?? 24 * 60 * 60 * 1000;

  if (policy.softTtlFinishedMs != null && isFinished) {
    effectiveSoft = policy.softTtlFinishedMs;
  }
  if (policy.hardTtlFinishedMs != null && isFinished) {
    effectiveHard = policy.hardTtlFinishedMs;
  }
  if (policy.softTtlAiringMs != null && isAiring) {
    effectiveSoft = policy.softTtlAiringMs;
  }
  if (policy.hardTtlAiringMs != null && isAiring) {
    effectiveHard = policy.hardTtlAiringMs;
  }
  if (policy.softTtlFrontierMs != null && isAiring && isFrontier) {
    effectiveSoft = policy.softTtlFrontierMs;
  }
  if (policy.hardTtlFrontierMs != null && isAiring && isFrontier) {
    effectiveHard = policy.hardTtlFrontierMs;
  }

  const effectiveNegative =
    policy.negativeCacheTtlMs ?? 24 * 60 * 60 * 1000;

  return {
    ...policy,
    effectiveSoftTtlMs: effectiveSoft,
    effectiveHardTtlMs: effectiveHard,
    effectiveNegativeTtlMs: effectiveNegative,
  };
}
