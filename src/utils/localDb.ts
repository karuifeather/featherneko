/**
 * Local database with a solid schema. Filled from multiple sources (MAL, Kitsu, AnimeAPI).
 * Merge rule: if a field is empty and the new source has a value, store it.
 * Over time the local DB becomes more complete. Only images (CDN) and video (m3u8) stay remote.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EpisodeRepairState } from '@/utils/episodeCacheValidation';

const PREFIX_ANIME = 'featherneko_local_anime_';
const PREFIX_EPISODES = 'featherneko_local_episodes_';
export const PREFIX_EPISODE_REPAIR = 'featherneko_episode_repair_';

/** Local anime record. All fields optional; sources fill in what they have. */
export interface LocalAnime {
  malId: number;
  kitsuId?: string;
  anilistId?: number;
  slug?: string;
  title?: string;
  canonicalTitle?: string;
  synopsis?: string;
  description?: string;
  coverImage?: string;
  bannerImage?: string;
  posterImage?: string;
  status?: string;
  episodeCount?: number;
  startDate?: string;
  endDate?: string;
  /** When we last merged data into this record (ISO string). */
  updatedAt?: string;
}

/** Local episode record. Keyed by malId + number. */
export interface LocalEpisode {
  malId: number;
  number: number;
  kitsuId?: string;
  /** Kitsu thumbnail (episode poster) - use for player when available */
  thumbnail?: string;
  /** AnimeAPI / provider snapshot image - use when no Kitsu thumbnail */
  image?: string;
  title?: string;
  canonicalTitle?: string;
  synopsis?: string;
  description?: string;
  airdate?: string;
  length?: number;
  /** Stream URL (may expire) - prefer fetching fresh when playing */
  streamUrl?: string;
  streamHeaders?: Record<string, string>;
  updatedAt?: string;
}

/** True if value is considered "empty" for merge (don't overwrite if we have something). */
function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) return Object.keys(v).length === 0;
  return false;
}

/** Merge partial into existing: only set when new value is non-empty and existing is empty. */
function mergeInto<T extends Record<string, unknown>>(existing: T, partial: Partial<T>): T {
  const result = { ...existing };
  for (const k of Object.keys(partial) as (keyof T)[]) {
    const newVal = partial[k];
    const existingVal = result[k];
    if (isEmpty(newVal)) continue;
    if (isEmpty(existingVal)) (result as Record<string, unknown>)[k as string] = newVal;
  }
  return result;
}

function animeKey(malId: number): string {
  return `${PREFIX_ANIME}${malId}`;
}

function episodesKey(malId: number): string {
  return `${PREFIX_EPISODES}${malId}`;
}

function episodeRepairKey(malId: number): string {
  return `${PREFIX_EPISODE_REPAIR}${malId}`;
}

/** Re-export for convenience */
export type { EpisodeRepairState };

/** Get merged anime record for MAL id. */
export async function getLocalAnime(malId: number): Promise<LocalAnime | null> {
  try {
    const raw = await AsyncStorage.getItem(animeKey(malId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalAnime;
    return parsed?.malId === malId ? parsed : null;
  } catch {
    return null;
  }
}

/** Merge partial anime data into local DB. Only fills empty fields. */
export async function mergeLocalAnime(malId: number, partial: Partial<Omit<LocalAnime, 'malId'>>): Promise<void> {
  try {
    const existing = await getLocalAnime(malId);
    const base: LocalAnime = existing ?? { malId };
    const merged = mergeInto(
      { ...base } as Record<string, unknown>,
      { ...partial, updatedAt: new Date().toISOString() } as Partial<Record<string, unknown>>
    ) as LocalAnime;
    merged.malId = malId;
    await AsyncStorage.setItem(animeKey(malId), JSON.stringify(merged));
  } catch (e) {
    if (__DEV__) console.warn('[localDb] mergeLocalAnime failed', e);
  }
}

/** Get all local episodes for an anime (by MAL id). */
export async function getLocalEpisodes(malId: number): Promise<LocalEpisode[]> {
  try {
    const raw = await AsyncStorage.getItem(episodesKey(malId));
    if (!raw) return [];
    const obj = JSON.parse(raw) as Record<string, LocalEpisode>;
    return Object.values(obj).filter((e) => e?.malId === malId);
  } catch {
    return [];
  }
}

/** Get one episode by MAL id and episode number. */
export async function getLocalEpisode(malId: number, episodeNumber: number): Promise<LocalEpisode | null> {
  try {
    const raw = await AsyncStorage.getItem(episodesKey(malId));
    if (!raw) return null;
    const obj = JSON.parse(raw) as Record<string, LocalEpisode>;
    const key = String(episodeNumber);
    const ep = obj[key];
    return ep?.malId === malId ? ep : null;
  } catch {
    return null;
  }
}

/** Get persisted episode repair state for an anime. */
export async function getEpisodeRepairState(malId: number): Promise<EpisodeRepairState | null> {
  try {
    const raw = await AsyncStorage.getItem(episodeRepairKey(malId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EpisodeRepairState;
    return parsed?.malId === malId ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist episode repair state for an anime. */
export async function setEpisodeRepairState(malId: number, state: EpisodeRepairState): Promise<void> {
  try {
    const toStore = { ...state, malId };
    await AsyncStorage.setItem(episodeRepairKey(malId), JSON.stringify(toStore));
  } catch (e) {
    if (__DEV__) console.warn('[localDb] setEpisodeRepairState failed', e);
  }
}

/** Merge episode data into local DB. Only fills empty fields. */
export async function mergeLocalEpisode(
  malId: number,
  episodeNumber: number,
  partial: Partial<Omit<LocalEpisode, 'malId' | 'number'>>
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(episodesKey(malId));
    const obj: Record<string, LocalEpisode> = raw ? JSON.parse(raw) : {};
    const key = String(episodeNumber);
    const existing = obj[key];
    const base: LocalEpisode = existing ?? { malId, number: episodeNumber };
    const merged = mergeInto(
      { ...base } as Record<string, unknown>,
      { ...partial, updatedAt: new Date().toISOString() } as Partial<Record<string, unknown>>
    ) as LocalEpisode;
    merged.malId = malId;
    merged.number = episodeNumber;
    obj[key] = merged;
    await AsyncStorage.setItem(episodesKey(malId), JSON.stringify(obj));
  } catch (e) {
    if (__DEV__) console.warn('[localDb] mergeLocalEpisode failed', e);
  }
}
