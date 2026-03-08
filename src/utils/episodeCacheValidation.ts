/**
 * Episode cache validation and repair system.
 *
 * Replaces blunt "small count = suspicious" heuristics with metadata-aware
 * classification. Distinguishes valid sparse results from suspicious ones,
 * uses Kitsu mapping confidence, and avoids infinite repair loops.
 */

/** AniList/MAL format values. Low-count formats where sparse is plausible. */
export const LOW_COUNT_FORMATS = new Set([
  'MOVIE',
  'OVA',
  'ONA',
  'SPECIAL',
  'TV_SHORT',
  'MUSIC',
  'PV',
  'CM',
]);

/** Formats where a very low count is more suspicious (long-form series). */
export const LONG_FORM_FORMATS = new Set(['TV']);

export type EpisodeCacheClassification =
  | 'valid'
  | 'sparse_plausible'
  | 'sparse_suspicious'
  | 'invalid';

export type KitsuResolutionConfidence = 'high' | 'medium' | 'low';

export interface EpisodeRepairState {
  malId: number;
  lastRepairAttemptAt?: number;
  repairAttemptCount: number;
  lastResolvedKitsuId?: string | null;
  lastObservedEpisodeCount?: number | null;
  lastExpectedEpisodeCount?: number | null;
  acceptedSparseAt?: number;
  acceptedSparseReason?: string;
}

export interface ValidationInput {
  /** Anime metadata */
  expectedEpisodes: number | null | undefined;
  status: string | null | undefined;
  format: string | null | undefined;
  malId: number;

  /** Episode data being validated */
  observedEpisodeCount: number;
  currentPage: number;
  pageSize: number;
  dataSource: 'page_cache' | 'local_entities' | 'fresh_network';

  /** Kitsu resolution metadata (newly resolved) */
  kitsuId: string | null;
  kitsuResolutionConfidence: KitsuResolutionConfidence;
  /** Cached kitsuId used when episodes were stored (for mismatch detection) */
  cachedKitsuId?: string | null;

  /** Repair state (from persisted store) */
  repairState: EpisodeRepairState | null;
}

export interface ValidationResult {
  classification: EpisodeCacheClassification;
  reason: string;
  shouldBypassCache: boolean;
  shouldAttemptRepair: boolean;
  shouldAcceptSparse: boolean;
  cooldownActive: boolean;
}

const REPAIR_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_REPAIR_ATTEMPTS = 3;
/** Observed count must be at least this fraction of expected to be "valid". */
const VALID_MATCH_THRESHOLD = 0.9;
/** Observed far below expected when ratio is below this. */
const SUSPICIOUS_RATIO_THRESHOLD = 0.2;

/**
 * Classify episode cache data into valid, sparse_plausible, sparse_suspicious, or invalid.
 */
export function classifyEpisodeCache(input: ValidationInput): ValidationResult {
  const {
    expectedEpisodes,
    status,
    format,
    observedEpisodeCount,
    currentPage,
    pageSize,
    kitsuId,
    kitsuResolutionConfidence,
    cachedKitsuId,
    repairState,
  } = input;

  const hasExpectedCount = typeof expectedEpisodes === 'number' && expectedEpisodes > 0;
  const isLowCountFormat = format != null && LOW_COUNT_FORMATS.has(format.toUpperCase());
  const isLongFormFormat = format != null && LONG_FORM_FORMATS.has(format.toUpperCase());
  const isFinished = status === 'FINISHED';
  const hasAcceptedSparse = repairState?.acceptedSparseAt != null;
  const recentRepairAttempt =
    repairState?.lastRepairAttemptAt != null &&
    Date.now() - repairState.lastRepairAttemptAt < REPAIR_COOLDOWN_MS;
  const repairAttemptsExhausted =
    (repairState?.repairAttemptCount ?? 0) >= MAX_REPAIR_ATTEMPTS;

  // --- Invalid: kitsuId mismatch (newly resolved differs from cached) ---
  const cachedId = cachedKitsuId ?? repairState?.lastResolvedKitsuId;
  if (
    kitsuId != null &&
    cachedId != null &&
    String(kitsuId) !== String(cachedId)
  ) {
    return {
      classification: 'invalid',
      reason: 'kitsu_id_mismatch',
      shouldBypassCache: true,
      shouldAttemptRepair: false,
      shouldAcceptSparse: false,
      cooldownActive: false,
    };
  }

  // --- Invalid: structural contradictions ---
  if (observedEpisodeCount < 0) {
    return {
      classification: 'invalid',
      reason: 'negative_episode_count',
      shouldBypassCache: true,
      shouldAttemptRepair: false,
      shouldAcceptSparse: false,
      cooldownActive: false,
    };
  }

  // --- Valid: observed matches expected ---
  if (hasExpectedCount && observedEpisodeCount >= expectedEpisodes! * VALID_MATCH_THRESHOLD) {
    return {
      classification: 'valid',
      reason: 'observed_matches_expected',
      shouldBypassCache: false,
      shouldAttemptRepair: false,
      shouldAcceptSparse: false,
      cooldownActive: false,
    };
  }

  if (hasExpectedCount && expectedEpisodes! <= pageSize && observedEpisodeCount === expectedEpisodes) {
    return {
      classification: 'valid',
      reason: 'small_expected_matches_observed',
      shouldBypassCache: false,
      shouldAttemptRepair: false,
      shouldAcceptSparse: false,
      cooldownActive: false,
    };
  }

  // Movie/OVA/ONA/SPECIAL with 1 episode and expected 1
  if (hasExpectedCount && expectedEpisodes === 1 && observedEpisodeCount === 1) {
    return {
      classification: 'valid',
      reason: 'single_episode_format_match',
      shouldBypassCache: false,
      shouldAttemptRepair: false,
      shouldAcceptSparse: false,
      cooldownActive: false,
    };
  }

  // Strong-contradiction checks run BEFORE hasAcceptedSparse so we can override
  // a previous acceptance when metadata now strongly suggests the data is wrong.
  const ratio = hasExpectedCount ? observedEpisodeCount / expectedEpisodes! : 1;
  const farBelowExpected = hasExpectedCount && ratio < SUSPICIOUS_RATIO_THRESHOLD;

  if (!hasExpectedCount && isLowCountFormat && observedEpisodeCount <= 5) {
    return {
      classification: 'sparse_plausible',
      reason: 'low_count_format_unknown_expected',
      shouldBypassCache: false,
      shouldAttemptRepair: false,
      shouldAcceptSparse: true,
      cooldownActive: false,
    };
  }

  // TV series with only 1 episode and unknown expected is suspicious (e.g. wrong Kitsu ID → movie)
  if (!hasExpectedCount && isLongFormFormat && observedEpisodeCount === 1) {
    if (repairAttemptsExhausted) {
      return {
        classification: 'sparse_suspicious',
        reason: 'repair_exhausted_tv_one_episode',
        shouldBypassCache: false,
        shouldAttemptRepair: false,
        shouldAcceptSparse: true,
        cooldownActive: true,
      };
    }
    if (recentRepairAttempt) {
      return {
        classification: 'sparse_suspicious',
        reason: 'repair_cooldown_tv_one_episode',
        shouldBypassCache: false,
        shouldAttemptRepair: false,
        shouldAcceptSparse: false,
        cooldownActive: true,
      };
    }
    return {
      classification: 'sparse_suspicious',
      reason: 'tv_one_episode_unknown_expected',
      shouldBypassCache: true,
      shouldAttemptRepair: true,
      shouldAcceptSparse: false,
      cooldownActive: false,
    };
  }

  if (!hasExpectedCount && kitsuResolutionConfidence === 'high' && observedEpisodeCount > 0) {
    return {
      classification: 'sparse_plausible',
      reason: 'unknown_expected_high_confidence',
      shouldBypassCache: false,
      shouldAttemptRepair: false,
      shouldAcceptSparse: true,
      cooldownActive: false,
    };
  }

  if (!hasExpectedCount && kitsuResolutionConfidence === 'medium' && observedEpisodeCount > 0) {
    return {
      classification: 'sparse_plausible',
      reason: 'unknown_expected_medium_confidence',
      shouldBypassCache: false,
      shouldAttemptRepair: false,
      shouldAcceptSparse: true,
      cooldownActive: false,
    };
  }

  // Unknown expected, low confidence, but format suggests low count
  if (!hasExpectedCount && isLowCountFormat) {
    return {
      classification: 'sparse_plausible',
      reason: 'unknown_expected_low_count_format',
      shouldBypassCache: false,
      shouldAttemptRepair: false,
      shouldAcceptSparse: true,
      cooldownActive: false,
    };
  }

  // TV format with 1 episode and unknown expected is suspicious (e.g. One Piece wrong mapping)
  if (!hasExpectedCount && isLongFormFormat && observedEpisodeCount === 1) {
    if (repairAttemptsExhausted) {
      return {
        classification: 'sparse_suspicious',
        reason: 'repair_exhausted_tv_one_episode',
        shouldBypassCache: false,
        shouldAttemptRepair: false,
        shouldAcceptSparse: true,
        cooldownActive: true,
      };
    }
    if (recentRepairAttempt) {
      return {
        classification: 'sparse_suspicious',
        reason: 'repair_cooldown_tv_one_episode',
        shouldBypassCache: false,
        shouldAttemptRepair: false,
        shouldAcceptSparse: false,
        cooldownActive: true,
      };
    }
    return {
      classification: 'sparse_suspicious',
      reason: 'tv_one_episode_unknown_expected',
      shouldBypassCache: true,
      shouldAttemptRepair: true,
      shouldAcceptSparse: false,
      cooldownActive: false,
    };
  }

  // Unknown expected, no strong signals - treat as plausible to avoid over-invalidation
  if (!hasExpectedCount) {
    return {
      classification: 'sparse_plausible',
      reason: 'unknown_expected_no_contradiction',
      shouldBypassCache: false,
      shouldAttemptRepair: false,
      shouldAcceptSparse: true,
      cooldownActive: false,
    };
  }

  // --- Sparse suspicious: strong contradiction ---
  if (hasExpectedCount && farBelowExpected && isLongFormFormat && isFinished) {
    if (repairAttemptsExhausted) {
      return {
        classification: 'sparse_suspicious',
        reason: 'repair_exhausted_cooldown',
        shouldBypassCache: false,
        shouldAttemptRepair: false,
        shouldAcceptSparse: true,
        cooldownActive: true,
      };
    }
    if (recentRepairAttempt) {
      return {
        classification: 'sparse_suspicious',
        reason: 'repair_cooldown_active',
        shouldBypassCache: false,
        shouldAttemptRepair: false,
        shouldAcceptSparse: false,
        cooldownActive: true,
      };
    }
    return {
      classification: 'sparse_suspicious',
      reason: 'tv_finished_far_below_expected',
      shouldBypassCache: true,
      shouldAttemptRepair: true,
      shouldAcceptSparse: false,
      cooldownActive: false,
    };
  }

  if (hasExpectedCount && farBelowExpected && kitsuResolutionConfidence === 'low') {
    if (repairAttemptsExhausted) {
      return {
        classification: 'sparse_suspicious',
        reason: 'repair_exhausted_low_confidence',
        shouldBypassCache: false,
        shouldAttemptRepair: false,
        shouldAcceptSparse: true,
        cooldownActive: true,
      };
    }
    if (recentRepairAttempt) {
      return {
        classification: 'sparse_suspicious',
        reason: 'repair_cooldown_low_confidence',
        shouldBypassCache: false,
        shouldAttemptRepair: false,
        shouldAcceptSparse: false,
        cooldownActive: true,
      };
    }
    return {
      classification: 'sparse_suspicious',
      reason: 'far_below_expected_low_confidence',
      shouldBypassCache: true,
      shouldAttemptRepair: true,
      shouldAcceptSparse: false,
      cooldownActive: false,
    };
  }

  if (hasExpectedCount && observedEpisodeCount === 1 && expectedEpisodes! >= 20) {
    if (repairAttemptsExhausted) {
      return {
        classification: 'sparse_suspicious',
        reason: 'repair_exhausted_one_vs_many',
        shouldBypassCache: false,
        shouldAttemptRepair: false,
        shouldAcceptSparse: true,
        cooldownActive: true,
      };
    }
    if (recentRepairAttempt) {
      return {
        classification: 'sparse_suspicious',
        reason: 'repair_cooldown_one_vs_many',
        shouldBypassCache: false,
        shouldAttemptRepair: false,
        shouldAcceptSparse: false,
        cooldownActive: true,
      };
    }
    return {
      classification: 'sparse_suspicious',
      reason: 'one_episode_but_expected_many',
      shouldBypassCache: true,
      shouldAttemptRepair: true,
      shouldAcceptSparse: false,
      cooldownActive: false,
    };
  }

  // --- Sparse suspicious: far below expected (catches format=null, expected 10–19, etc.) ---
  if (hasExpectedCount && farBelowExpected) {
    if (repairAttemptsExhausted) {
      return {
        classification: 'sparse_suspicious',
        reason: 'repair_exhausted_far_below_expected',
        shouldBypassCache: false,
        shouldAttemptRepair: false,
        shouldAcceptSparse: true,
        cooldownActive: true,
      };
    }
    if (recentRepairAttempt) {
      return {
        classification: 'sparse_suspicious',
        reason: 'repair_cooldown_far_below_expected',
        shouldBypassCache: false,
        shouldAttemptRepair: false,
        shouldAcceptSparse: false,
        cooldownActive: true,
      };
    }
    return {
      classification: 'sparse_suspicious',
      reason: 'far_below_expected',
      shouldBypassCache: true,
      shouldAttemptRepair: true,
      shouldAcceptSparse: false,
      cooldownActive: false,
    };
  }

  // --- Default: sparse plausible ---
  return {
    classification: 'sparse_plausible',
    reason: 'default_plausible',
    shouldBypassCache: false,
    shouldAttemptRepair: false,
    shouldAcceptSparse: true,
    cooldownActive: false,
  };
}

/**
 * Decide whether to trust cached/local episode data based on validation result.
 */
export function shouldTrustCache(result: ValidationResult): boolean {
  if (result.shouldBypassCache) return false;
  if (result.classification === 'valid') return true;
  if (result.classification === 'sparse_plausible') return true;
  if (result.classification === 'sparse_suspicious' && result.shouldAcceptSparse) return true;
  return false;
}

/** @deprecated Use shouldTrustCache instead */
export const shouldTrustCachedData = shouldTrustCache;

export interface RepairDecision {
  shouldAttemptRepair: boolean;
  shouldBypassCache: boolean;
  shouldAcceptSparse: boolean;
  /** Updated repair state to persist after this decision (if repair attempted) */
  nextRepairState?: Partial<EpisodeRepairState>;
}

/**
 * Get repair decision from validation result and current repair state.
 * Callers use this to decide whether to bypass cache, attempt repair, or accept sparse data.
 */
export function getRepairDecision(
  result: ValidationResult,
  repairState: EpisodeRepairState | null
): RepairDecision {
  const now = Date.now();
  const decision: RepairDecision = {
    shouldAttemptRepair: result.shouldAttemptRepair,
    shouldBypassCache: result.shouldBypassCache,
    shouldAcceptSparse: result.shouldAcceptSparse,
  };

  if (result.shouldAttemptRepair && repairState) {
    decision.nextRepairState = {
      lastRepairAttemptAt: now,
      repairAttemptCount: (repairState.repairAttemptCount ?? 0) + 1,
    };
  }

  return decision;
}
