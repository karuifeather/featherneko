/**
 * Anime media cache with stable/volatile split.
 * Stable segment stored long-lived; volatile segment refreshable.
 */

import * as cacheService from "./cacheService";
import {
  splitAnilistMedia,
  recomposeAnilistMedia,
  type AnilistMediaFull,
  type AnilistMediaStable,
  type AnilistMediaVolatile,
} from "./utils/anilistMediaSplit";

const STABLE_NS = "ANIME_MEDIA_STABLE";
const VOLATILE_NS = "ANIME_MEDIA_VOLATILE";

function stableKey(malId: number): string {
  return `stable:${malId}`;
}

function volatileKey(malId: number): string {
  return `volatile:${malId}`;
}

/**
 * Get merged anime media. Reads stable + volatile and recomposes.
 * Falls back to legacy ANILIST_MEDIA and migrates on read.
 */
export async function getAnimeMedia(
  malId: number,
  context?: { isCompletedSeries?: boolean; isAiringSeries?: boolean }
): Promise<AnilistMediaFull | null> {
  const sk = stableKey(malId);
  const vk = volatileKey(malId);

  const [stableRes, volatileRes] = await Promise.all([
    cacheService.get<AnilistMediaStable>(STABLE_NS, sk, context),
    cacheService.get<AnilistMediaVolatile>(VOLATILE_NS, vk, context),
  ]);

  const stable =
    stableRes.hit && stableRes.data
      ? (stableRes.data as AnilistMediaStable)
      : null;

  if (stable) {
    const volatile =
      volatileRes.hit && volatileRes.data
        ? (volatileRes.data as AnilistMediaVolatile)
        : null;
    return recomposeAnilistMedia(stable, volatile ?? undefined);
  }

  const legacy = await cacheService.get<AnilistMediaFull>("ANILIST_MEDIA", String(malId), context);
  if (legacy.hit && legacy.data) {
    const full = legacy.data as AnilistMediaFull;
    await setAnimeMedia(malId, full, context);
    await cacheService.remove("ANILIST_MEDIA", String(malId));
    return full;
  }

  return null;
}

/**
 * Store anime media using stable/volatile split.
 */
export async function setAnimeMedia(
  malId: number,
  media: AnilistMediaFull,
  context?: { isCompletedSeries?: boolean; isAiringSeries?: boolean }
): Promise<void> {
  const { stable, volatile } = splitAnilistMedia(media);
  const sk = stableKey(malId);
  const vk = volatileKey(malId);

  await Promise.all([
    cacheService.set(STABLE_NS, sk, stable, context, { immutable: true }),
    cacheService.set(VOLATILE_NS, vk, volatile, context),
  ]);
}
