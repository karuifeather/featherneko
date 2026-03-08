/**
 * Persist user's "which provider anime" choice per (malId, apiId).
 * Uses new policy-driven cache with STREAMING_PICK_PREFERENCE (durable).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as cacheService from '@/cache/cacheService';
import type { StreamingSearchResult } from './streamingSlugResolver';

const NAMESPACE = 'STREAMING_PICK_PREFERENCE';
const LEGACY_KEY = 'featherneko_streaming_pick';

export type CachedStreamingPick = Pick<StreamingSearchResult, 'id' | 'title' | 'image'>;

function cacheKey(malId: number, apiId: string): string {
  return `${malId}:${apiId}`;
}

let legacyLoaded = false;

async function migrateLegacy(): Promise<void> {
  if (legacyLoaded) return;
  legacyLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CachedStreamingPick>;
    if (typeof parsed !== 'object') return;
    for (const [k, v] of Object.entries(parsed)) {
      if (v?.id) await cacheService.set(NAMESPACE, k, v);
    }
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export async function getCachedStreamingPick(
  malId: number,
  apiId: string
): Promise<CachedStreamingPick | null> {
  await migrateLegacy();
  const key = cacheKey(malId, apiId);
  const result = await cacheService.get<CachedStreamingPick>(NAMESPACE, key);
  return result.hit && result.data ? result.data : null;
}

export async function setCachedStreamingPick(
  malId: number,
  apiId: string,
  pick: CachedStreamingPick
): Promise<void> {
  await migrateLegacy();
  const key = cacheKey(malId, apiId);
  await cacheService.set(NAMESPACE, key, pick);
}

export async function clearCachedStreamingPick(malId?: number, apiId?: string): Promise<void> {
  await migrateLegacy();
  if (malId != null && apiId != null) {
    await cacheService.remove(NAMESPACE, cacheKey(malId, apiId));
  } else {
    await cacheService.clearNamespace(NAMESPACE);
  }
}
