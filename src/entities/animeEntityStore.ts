/**
 * Anime entity store. Durable storage for normalized anime data.
 * Builds on localDb with policy-aware semantics.
 */

import {
  getLocalAnime,
  mergeLocalAnime,
  type LocalAnime,
} from '@/utils/localDb';

export type AnimeEntity = LocalAnime;

export async function getAnimeEntity(malId: number): Promise<AnimeEntity | null> {
  return getLocalAnime(malId);
}

export async function mergeAnimeEntity(
  malId: number,
  partial: Partial<Omit<AnimeEntity, 'malId'>>
): Promise<void> {
  await mergeLocalAnime(malId, partial);
}
