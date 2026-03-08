/**
 * Episode entity store. Durable storage for normalized episode metadata.
 * Builds on localDb. Episode pages normalize into entities on fetch.
 */

import {
  getLocalEpisodes,
  getLocalEpisode,
  mergeLocalEpisode,
  type LocalEpisode,
} from '@/utils/localDb';

export type EpisodeEntity = LocalEpisode;

export async function getEpisodeEntities(malId: number): Promise<EpisodeEntity[]> {
  return getLocalEpisodes(malId);
}

export async function getEpisodeEntity(
  malId: number,
  episodeNumber: number
): Promise<EpisodeEntity | null> {
  return getLocalEpisode(malId, episodeNumber);
}

export async function mergeEpisodeEntity(
  malId: number,
  episodeNumber: number,
  partial: Partial<Omit<EpisodeEntity, 'malId' | 'number'>>
): Promise<void> {
  await mergeLocalEpisode(malId, episodeNumber, partial);
}
