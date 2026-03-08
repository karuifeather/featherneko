/**
 * Resolve a Kitsu anime id for a title.
 *
 * Kitsu anime existence and Kitsu external mappings are separate datasets; some titles may exist in Kitsu
 * but lack a MAL/AniList mapping row. Treat empty mappings as normal and fall back to search.
 */

import { fetchWithSourceHealth } from '@/cache/fetchWithSourceHealth';
import { getLocalAnime, mergeLocalAnime } from '@/utils/localDb';
import type { KitsuResolutionConfidence } from '@/utils/episodeCacheValidation';

export interface ResolveKitsuResult {
  kitsuId: string;
  confidence: KitsuResolutionConfidence;
}

type ResolveKitsuAnimeIdInput = {
  /** MyAnimeList anime id (AniList `idMal`) */
  idMal?: number | null;
  /** AniList internal id (AniList `id`) */
  anilistId?: number | null;
  titleEnglish?: string | null;
  titleRomaji?: string | null;
  /** When true, skip local anime cache and force fresh mapping lookup. Use when recovering from sparse/wrong episode data. */
  bypassLocalCache?: boolean;
};

const mem = new Map<string, ResolveKitsuResult>();

function keyFor(input: ResolveKitsuAnimeIdInput): string | null {
  if (input.idMal != null) return `mal:${input.idMal}`;
  if (input.anilistId != null) return `anilist:${input.anilistId}`;
  return null;
}

function pickTitle(input: ResolveKitsuAnimeIdInput): string {
  return (
    (typeof input.titleEnglish === 'string' ? input.titleEnglish : '') ||
    (typeof input.titleRomaji === 'string' ? input.titleRomaji : '') ||
    ''
  )
    .trim();
}

async function resolveViaMapping(externalSite: string, externalId: number): Promise<string | null> {
  const url =
    `https://kitsu.io/api/edge/mappings` +
    `?filter[externalSite]=${encodeURIComponent(externalSite)}` +
    `&filter[externalId]=${encodeURIComponent(String(externalId))}` +
    `&include=item` +
    `&page[limit]=1`;

  const res = await fetchWithSourceHealth(url, { timeout: 10000, source: 'kitsu' });
  const data = res.data;
  const hasData = Array.isArray(data?.data) && data.data.length > 0;
  if (!hasData) return null;

  // Kitsu returns the mapped item in `included` when `include=item` is used.
  const included = Array.isArray(data?.included) ? data.included : [];
  const anime = included.find((x: any) => x?.type === 'anime' && typeof x?.id === 'string');
  return anime?.id ?? null;
}

async function resolveViaSearch(title: string): Promise<string | null> {
  const url =
    `https://kitsu.io/api/edge/anime` +
    `?filter[text]=${encodeURIComponent(title)}` +
    `&page[limit]=1`;
  const res = await fetchWithSourceHealth(url, { timeout: 10000, source: 'kitsu' });
  const first = res.data?.data?.[0];
  const id = typeof first?.id === 'string' ? first.id : null;
  if (id && __DEV__) console.log('Kitsu resolver: resolved via search');
  return id;
}

export async function resolveKitsuAnimeId(
  input: ResolveKitsuAnimeIdInput
): Promise<ResolveKitsuResult | null> {
  const k = keyFor(input);
  if (k) {
    const hit = mem.get(k);
    if (hit) return hit;
  }

  if (input.idMal != null && !input.bypassLocalCache) {
    const local = await getLocalAnime(input.idMal);
    if (local?.kitsuId) {
      const result: ResolveKitsuResult = { kitsuId: local.kitsuId, confidence: 'medium' };
      mem.set(`mal:${input.idMal}`, result);
      return result;
    }
  }

  if (input.idMal != null) {
    const kitsuId = await resolveViaMapping('myanimelist/anime', input.idMal);
    if (kitsuId) {
      const result: ResolveKitsuResult = { kitsuId, confidence: 'high' };
      mem.set(`mal:${input.idMal}`, result);
      await mergeLocalAnime(input.idMal, {
        kitsuId,
        anilistId: input.anilistId ?? undefined,
      });
      return result;
    }
    if (__DEV__) console.log('Kitsu resolver: MAL mapping missing for idMal=', input.idMal);
  }

  if (input.anilistId != null) {
    const kitsuId = await resolveViaMapping('anilist/anime', input.anilistId);
    if (kitsuId) {
      const result: ResolveKitsuResult = { kitsuId, confidence: 'high' };
      if (input.idMal != null) {
        mem.set(`mal:${input.idMal}`, result);
        await mergeLocalAnime(input.idMal, {
          kitsuId,
          anilistId: input.anilistId,
        });
      } else {
        mem.set(`anilist:${input.anilistId}`, result);
      }
      return result;
    }
    if (__DEV__) console.log('Kitsu resolver: AniList mapping missing for id=', input.anilistId);
  }

  const title = pickTitle(input);
  if (!title) return null;
  if (__DEV__) console.log('Kitsu resolver: falling back to Kitsu title search for', title);

  const kitsuId = await resolveViaSearch(title);
  if (!kitsuId) return null;

  const result: ResolveKitsuResult = { kitsuId, confidence: 'low' };
  if (input.idMal != null) {
    mem.set(`mal:${input.idMal}`, result);
    await mergeLocalAnime(input.idMal, {
      kitsuId,
      anilistId: input.anilistId ?? undefined,
      title: title,
    });
  } else if (input.anilistId != null) {
    mem.set(`anilist:${input.anilistId}`, result);
  }

  return result;
}

