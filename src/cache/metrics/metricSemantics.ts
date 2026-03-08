/**
 * Metric semantics for Cache Insights. Defines what each derived metric means
 * to prevent double-counting and ensure credible reporting.
 *
 * DERIVATION RULES:
 *
 * readsServedWithoutNetwork:
 *   Count of cache reads that returned data without a synchronous network fetch.
 *   = memoryHits + persistentHits + entityHits + negativeHits
 *   Distinct from requestsAvoided: a read can be served from cache while a
 *   background revalidation still triggers a network request.
 *
 * networkRequestsAvoided (requestsAvoidedTotal):
 *   Count of network requests that were fully skipped (no fetch, not even in background).
 *   Components (no double-counting):
 *   - requestsAvoidedFresh: cache hit with status fresh/immutable, no revalidation
 *   - requestsAvoidedNegative: negative cache hit used to skip re-query
 *   - requestsAvoidedBySourceHealth: fetch skipped because source rate-limited
 *   - requestsDeduped: duplicate in-flight requests collapsed (N-1 avoided per coalesced group)
 *   - entityPageReconstructions: page built from entities, no network fetch
 *   NOT included: stale reads with background revalidation (network still happens)
 *
 * estimatedSavedMs:
 *   Conservative estimate of load time saved by serving from cache instead of network.
 *   Method: when we have actual network fetch timings, use average; otherwise use
 *   fixed baseline (100ms). Cap per-request estimate at 500ms to avoid inflation.
 *   Formula: min(avgNetworkMs, 500) * requestsAvoidedTotal
 *   Never negative. Clearly labeled "estimated" in UI.
 */

export const CONSERVATIVE_MS_PER_AVOIDED = 100;
export const MAX_MS_PER_AVOIDED = 500;
