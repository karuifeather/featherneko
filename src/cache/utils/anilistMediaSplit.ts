/**
 * Split AniList media object into stable (durable) and volatile (refreshable) segments.
 * Stable fields rarely change; volatile fields (scores, popularity, etc.) drift over time.
 */

/** Stable fields: store long-lived / entity-oriented. */
const STABLE_KEYS = new Set([
  "id",
  "idMal",
  "title",
  "genres",
  "bannerImage",
  "coverImage",
  "description",
  "format",
  "status",
  "episodes",
  "startDate",
  "endDate",
  "source",
  "relations",
  "characters",
  "reviews",
  "recommendations",
  "studios",
  "trailer",
]);

/** Volatile fields: refresh more often. */
const VOLATILE_KEYS = new Set([
  "averageScore",
  "meanScore",
  "popularity",
  "favourites",
  "trending",
  "rankings",
  "nextAiringEpisode",
  "stats",
]);

export interface AnilistMediaStable {
  id?: number;
  idMal?: number;
  title?: { english?: string; romaji?: string };
  genres?: string[];
  bannerImage?: string;
  coverImage?: { large?: string } | string;
  description?: string;
  format?: string;
  status?: string;
  episodes?: number;
  startDate?: { day?: number; month?: number; year?: number };
  endDate?: { day?: number; month?: number; year?: number };
  source?: string;
  relations?: unknown;
  characters?: unknown;
  reviews?: { pageInfo?: { total?: number } };
  recommendations?: { pageInfo?: { total?: number } };
  studios?: unknown;
  trailer?: unknown;
}

export interface AnilistMediaVolatile {
  averageScore?: number;
  meanScore?: number;
  popularity?: number;
  favourites?: number;
  trending?: number;
  rankings?: Array<{ rank?: number; context?: string; allTime?: boolean; year?: number; season?: string }>;
  nextAiringEpisode?: { episode?: number; airingAt?: number; timeUntilAiring?: number };
  stats?: unknown;
}

export type AnilistMediaFull = AnilistMediaStable & AnilistMediaVolatile & Record<string, unknown>;

/**
 * Split media object into stable and volatile segments.
 */
export function splitAnilistMedia(media: AnilistMediaFull): {
  stable: AnilistMediaStable;
  volatile: AnilistMediaVolatile;
} {
  const stable: Record<string, unknown> = {};
  const volatile: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(media)) {
    if (v === undefined) continue;
    if (STABLE_KEYS.has(k)) {
      stable[k] = v;
    } else if (VOLATILE_KEYS.has(k)) {
      volatile[k] = v;
    } else {
      stable[k] = v;
    }
  }

  return {
    stable: stable as AnilistMediaStable,
    volatile: volatile as AnilistMediaVolatile,
  };
}

/**
 * Recompose stable + volatile into a single media object for UI consumption.
 * Volatile overrides stable when both have a field (volatile is newer).
 */
export function recomposeAnilistMedia(
  stable: AnilistMediaStable,
  volatile?: AnilistMediaVolatile | null
): AnilistMediaFull {
  const merged = { ...stable } as AnilistMediaFull;
  if (volatile && typeof volatile === "object") {
    for (const [k, v] of Object.entries(volatile)) {
      if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
    }
  }
  return merged;
}
