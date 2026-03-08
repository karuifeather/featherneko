/**
 * Core cache types for the policy-driven caching system.
 * See docs/cache.md for full architecture.
 */

export type CacheStatus =
  | 'fresh'
  | 'stale'
  | 'expired'
  | 'immutable'
  | 'negative'
  | 'broken';

export type StorageTier = 'memory' | 'persistent' | 'entity';

export type RevalidationMode = 'none' | 'on-read' | 'background' | 'blocking';

export type CacheSource =
  | 'anilist'
  | 'kitsu'
  | 'animeapi'
  | 'provider'
  | 'derived'
  | 'local'
  | 'mal'
  | 'jikan';

export type MergeStrategy = 'replace' | 'shallow-merge' | 'entity-merge';

export type CachePriority = 'low' | 'normal' | 'high' | 'critical';

export type SourceHealth = 'healthy' | 'degraded' | 'rate_limited';

export interface CachePolicy {
  namespace: string;
  storageTier: StorageTier;
  memoryEnabled: boolean;
  negativeCacheTtlMs?: number;
  softTtlMs?: number;
  hardTtlMs?: number;
  immutable?: boolean;
  revalidationMode: RevalidationMode;
  maxEntries?: number;
  source?: CacheSource;
  allowStaleOnError?: boolean;
  mergeStrategy?: MergeStrategy;
  priority?: CachePriority;
  /** Context-dependent: use soft/hard for airing vs finished anime */
  softTtlAiringMs?: number;
  hardTtlAiringMs?: number;
  softTtlFinishedMs?: number;
  hardTtlFinishedMs?: number;
  softTtlFrontierMs?: number;
  hardTtlFrontierMs?: number;
}

export interface CacheEntryMeta {
  namespace: string;
  key: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  fetchedAt: number;
  lastAccessedAt: number;
  accessCount: number;
  softExpiresAt?: number;
  hardExpiresAt?: number;
  immutable?: boolean;
  negative?: boolean;
  source?: CacheSource;
  sizeBytesApprox?: number;
  tags?: string[];
  context?: Record<string, unknown>;
}

export interface CacheEntry<T = unknown> {
  meta: CacheEntryMeta;
  data: T | null;
}

export interface CacheReadResult<T = unknown> {
  hit: boolean;
  status: CacheStatus;
  data: T | null;
  meta?: CacheEntryMeta;
  shouldRevalidate: boolean;
}

export interface CacheContext {
  animeStatus?:
    | 'FINISHED'
    | 'RELEASING'
    | 'NOT_YET_RELEASED'
    | 'CANCELLED'
    | 'HIATUS'
    | string;
  totalEpisodes?: number | null;
  currentEpisode?: number | null;
  isCompletedSeries?: boolean;
  isAiringSeries?: boolean;
  isFrontierPage?: boolean;
  sourceHealth?: SourceHealth;
}

export interface ResolvedCachePolicy extends CachePolicy {
  effectiveSoftTtlMs: number;
  effectiveHardTtlMs: number;
  effectiveNegativeTtlMs: number;
}
