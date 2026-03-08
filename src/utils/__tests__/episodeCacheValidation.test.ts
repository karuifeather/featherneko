/**
 * Tests for episode cache validation and repair system.
 *
 * Covers rare scenarios that caused bugs:
 * - TV series with 1 episode (wrong Kitsu ID → movie) - One Piece, MHA
 * - far_below_expected (expected 13, observed 1)
 * - hasAcceptedSparse must NOT block strong-contradiction checks
 * - Repair cooldown and exhausted attempts
 */

import {
  classifyEpisodeCache,
  shouldTrustCache,
  getRepairDecision,
  type ValidationInput,
  type EpisodeRepairState,
} from '../episodeCacheValidation';

const baseInput: ValidationInput = {
  expectedEpisodes: null,
  status: 'RELEASING',
  format: 'TV',
  malId: 21,
  observedEpisodeCount: 1,
  currentPage: 1,
  pageSize: 10,
  dataSource: 'local_entities',
  kitsuId: '12',
  kitsuResolutionConfidence: 'medium',
  cachedKitsuId: '12',
  repairState: null,
};

describe('episodeCacheValidation', () => {
  describe('classifyEpisodeCache - rare scenarios', () => {
    describe('TV series with 1 episode, unknown expected (One Piece / MHA bug)', () => {
      it('triggers repair when TV has 1 episode and expected is unknown', () => {
        const result = classifyEpisodeCache({
          ...baseInput,
          format: 'TV',
          expectedEpisodes: null,
          observedEpisodeCount: 1,
        });
        expect(result.reason).toBe('tv_one_episode_unknown_expected');
        expect(result.shouldAttemptRepair).toBe(true);
        expect(result.shouldBypassCache).toBe(true);
        expect(result.shouldAcceptSparse).toBe(false);
      });

      it('strong-contradiction overrides hasAcceptedSparse (regression: must not block repair)', () => {
        const repairState: EpisodeRepairState = {
          malId: 21,
          repairAttemptCount: 0,
          acceptedSparseAt: Date.now() - 1000,
          acceptedSparseReason: 'unknown_expected_medium_confidence',
        };
        const result = classifyEpisodeCache({
          ...baseInput,
          format: 'TV',
          expectedEpisodes: null,
          observedEpisodeCount: 1,
          repairState,
        });
        // Must NOT return previously_accepted_sparse - must trigger repair
        expect(result.reason).toBe('tv_one_episode_unknown_expected');
        expect(result.shouldAttemptRepair).toBe(true);
        expect(result.shouldBypassCache).toBe(true);
      });

      it('respects repair cooldown for TV+1 episode', () => {
        const repairState: EpisodeRepairState = {
          malId: 21,
          repairAttemptCount: 1,
          lastRepairAttemptAt: Date.now() - 1000, // 1 second ago
        };
        const result = classifyEpisodeCache({
          ...baseInput,
          format: 'TV',
          expectedEpisodes: null,
          observedEpisodeCount: 1,
          repairState,
        });
        expect(result.reason).toBe('repair_cooldown_tv_one_episode');
        expect(result.shouldAttemptRepair).toBe(false);
        expect(result.cooldownActive).toBe(true);
      });

      it('accepts sparse when repair attempts exhausted for TV+1 episode', () => {
        const repairState: EpisodeRepairState = {
          malId: 21,
          repairAttemptCount: 3,
        };
        const result = classifyEpisodeCache({
          ...baseInput,
          format: 'TV',
          expectedEpisodes: null,
          observedEpisodeCount: 1,
          repairState,
        });
        expect(result.reason).toBe('repair_exhausted_tv_one_episode');
        expect(result.shouldAttemptRepair).toBe(false);
        expect(result.shouldAcceptSparse).toBe(true);
      });
    });

    describe('far_below_expected (expected 13, observed 1)', () => {
      it('triggers repair when observed far below expected', () => {
        const result = classifyEpisodeCache({
          ...baseInput,
          expectedEpisodes: 13,
          observedEpisodeCount: 1,
          format: null,
        });
        expect(result.reason).toBe('far_below_expected');
        expect(result.shouldAttemptRepair).toBe(true);
        expect(result.shouldBypassCache).toBe(true);
      });

      it('triggers repair for TV+FINISHED+far_below_expected', () => {
        const result = classifyEpisodeCache({
          ...baseInput,
          expectedEpisodes: 13,
          observedEpisodeCount: 1,
          format: 'TV',
          status: 'FINISHED',
        });
        expect(result.reason).toBe('tv_finished_far_below_expected');
        expect(result.shouldAttemptRepair).toBe(true);
      });

      it('respects repair cooldown for far_below_expected', () => {
        const repairState: EpisodeRepairState = {
          malId: 31964,
          repairAttemptCount: 1,
          lastRepairAttemptAt: Date.now() - 1000,
        };
        const result = classifyEpisodeCache({
          ...baseInput,
          malId: 31964,
          expectedEpisodes: 13,
          observedEpisodeCount: 1,
          repairState,
        });
        expect(result.reason).toBe('repair_cooldown_far_below_expected');
        expect(result.shouldAttemptRepair).toBe(false);
      });

      it('accepts sparse when repair exhausted for far_below_expected', () => {
        const repairState: EpisodeRepairState = {
          malId: 31964,
          repairAttemptCount: 3,
        };
        const result = classifyEpisodeCache({
          ...baseInput,
          malId: 31964,
          expectedEpisodes: 13,
          observedEpisodeCount: 1,
          repairState,
        });
        expect(result.reason).toBe('repair_exhausted_far_below_expected');
        expect(result.shouldAttemptRepair).toBe(false);
        expect(result.shouldAcceptSparse).toBe(true);
      });
    });

    describe('one_episode_but_expected_many', () => {
      it('triggers repair when 1 episode observed but expected 20+', () => {
        const result = classifyEpisodeCache({
          ...baseInput,
          expectedEpisodes: 24,
          observedEpisodeCount: 1,
          format: 'TV',
        });
        expect(result.reason).toBe('one_episode_but_expected_many');
        expect(result.shouldAttemptRepair).toBe(true);
      });
    });

    describe('Kitsu ID mismatch', () => {
      it('returns invalid when newly resolved kitsuId differs from cached', () => {
        const result = classifyEpisodeCache({
          ...baseInput,
          kitsuId: '999',
          cachedKitsuId: '12',
        });
        expect(result.classification).toBe('invalid');
        expect(result.reason).toBe('kitsu_id_mismatch');
        expect(result.shouldBypassCache).toBe(true);
      });

      it('returns invalid when kitsuId differs from repairState.lastResolvedKitsuId', () => {
        const result = classifyEpisodeCache({
          ...baseInput,
          kitsuId: '999',
          cachedKitsuId: null,
          repairState: { malId: 21, repairAttemptCount: 0, lastResolvedKitsuId: '12' },
        });
        expect(result.classification).toBe('invalid');
        expect(result.reason).toBe('kitsu_id_mismatch');
      });
    });

    describe('Low-count formats (MOVIE, OVA) - sparse is plausible', () => {
      it('accepts 1 episode for MOVIE with unknown expected', () => {
        const result = classifyEpisodeCache({
          ...baseInput,
          format: 'MOVIE',
          expectedEpisodes: null,
          observedEpisodeCount: 1,
        });
        expect(result.reason).toBe('low_count_format_unknown_expected');
        expect(result.shouldAttemptRepair).toBe(false);
        expect(result.shouldAcceptSparse).toBe(true);
      });

      it('accepts 1 episode for OVA with unknown expected', () => {
        const result = classifyEpisodeCache({
          ...baseInput,
          format: 'OVA',
          expectedEpisodes: null,
          observedEpisodeCount: 1,
        });
        expect(result.reason).toBe('low_count_format_unknown_expected');
        expect(result.shouldAcceptSparse).toBe(true);
      });
    });

    describe('Valid cases', () => {
      it('valid when observed matches expected', () => {
        const result = classifyEpisodeCache({
          ...baseInput,
          expectedEpisodes: 13,
          observedEpisodeCount: 13,
        });
        expect(result.classification).toBe('valid');
        expect(result.reason).toBe('observed_matches_expected');
      });

      it('valid when observed >= 90% of expected', () => {
        const result = classifyEpisodeCache({
          ...baseInput,
          expectedEpisodes: 10,
          observedEpisodeCount: 9,
        });
        expect(result.classification).toBe('valid');
      });

      it('valid for MOVIE with expected 1 and observed 1', () => {
        const result = classifyEpisodeCache({
          ...baseInput,
          format: 'MOVIE',
          expectedEpisodes: 1,
          observedEpisodeCount: 1,
        });
        expect(result.classification).toBe('valid');
        expect(['single_episode_format_match', 'observed_matches_expected']).toContain(result.reason);
      });
    });

    describe('Invalid cases', () => {
      it('returns invalid for negative episode count', () => {
        const result = classifyEpisodeCache({
          ...baseInput,
          observedEpisodeCount: -1,
        });
        expect(result.classification).toBe('invalid');
        expect(result.reason).toBe('negative_episode_count');
      });
    });
  });

  describe('shouldTrustCache', () => {
    it('returns false when shouldBypassCache is true', () => {
      expect(
        shouldTrustCache({
          classification: 'sparse_suspicious',
          reason: 'tv_one_episode_unknown_expected',
          shouldBypassCache: true,
          shouldAttemptRepair: true,
          shouldAcceptSparse: false,
          cooldownActive: false,
        })
      ).toBe(false);
    });

    it('returns true for valid classification', () => {
      expect(
        shouldTrustCache({
          classification: 'valid',
          reason: 'observed_matches_expected',
          shouldBypassCache: false,
          shouldAttemptRepair: false,
          shouldAcceptSparse: false,
          cooldownActive: false,
        })
      ).toBe(true);
    });

    it('returns true for sparse_plausible', () => {
      expect(
        shouldTrustCache({
          classification: 'sparse_plausible',
          reason: 'low_count_format_unknown_expected',
          shouldBypassCache: false,
          shouldAttemptRepair: false,
          shouldAcceptSparse: true,
          cooldownActive: false,
        })
      ).toBe(true);
    });

    it('returns true for sparse_suspicious when shouldAcceptSparse (exhausted)', () => {
      expect(
        shouldTrustCache({
          classification: 'sparse_suspicious',
          reason: 'repair_exhausted_tv_one_episode',
          shouldBypassCache: false,
          shouldAttemptRepair: false,
          shouldAcceptSparse: true,
          cooldownActive: true,
        })
      ).toBe(true);
    });

    it('returns false for sparse_suspicious when not shouldAcceptSparse', () => {
      expect(
        shouldTrustCache({
          classification: 'sparse_suspicious',
          reason: 'repair_cooldown_tv_one_episode',
          shouldBypassCache: false,
          shouldAttemptRepair: false,
          shouldAcceptSparse: false,
          cooldownActive: true,
        })
      ).toBe(false);
    });
  });

  describe('getRepairDecision', () => {
    it('increments repairAttemptCount when shouldAttemptRepair', () => {
      const result = classifyEpisodeCache({
        ...baseInput,
        format: 'TV',
        expectedEpisodes: null,
        observedEpisodeCount: 1,
      });
      const decision = getRepairDecision(result, {
        malId: 21,
        repairAttemptCount: 1,
      });
      expect(decision.shouldAttemptRepair).toBe(true);
      expect(decision.nextRepairState?.repairAttemptCount).toBe(2);
      expect(decision.nextRepairState?.lastRepairAttemptAt).toBeDefined();
    });

    it('returns no nextRepairState when not shouldAttemptRepair', () => {
      const result = classifyEpisodeCache({
        ...baseInput,
        format: 'MOVIE',
        expectedEpisodes: null,
        observedEpisodeCount: 1,
      });
      const decision = getRepairDecision(result, { malId: 21, repairAttemptCount: 0 });
      expect(decision.shouldAttemptRepair).toBe(false);
      expect(decision.nextRepairState).toBeUndefined();
    });
  });
});
