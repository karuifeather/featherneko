/**
 * Migrate from legacy single-blob cache (featherneko_cache_v1) to per-entry v2.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheLog, cacheWarn } from '../utils/logger';
import * as responseCache from '../persistent/responseCache';
import { recordCacheMetric } from '../metrics';

const LEGACY_KEY = 'featherneko_cache_v1';
const MIGRATED_FLAG = 'featherneko_cache_migrated_v1';

const BUCKET_TO_NAMESPACE: Record<string, string> = {
  anilist_media: 'ANILIST_MEDIA',
  anilist_feed: 'ANILIST_FEED',
  slug_cache: 'SLUG_CACHE',
  anilist_characters: 'ANILIST_CHARACTERS',
  anilist_reviews: 'ANILIST_REVIEWS',
  anilist_recommendations: 'ANILIST_RECOMMENDATIONS',
  kitsu_episodes_page: 'KITSU_EPISODES_PAGE',
};

interface LegacyEntry {
  data: unknown;
  fetchedAt: number;
  expiresAt?: number;
}

export async function migrateIfNeeded(): Promise<boolean> {
  try {
    const migrated = await AsyncStorage.getItem(MIGRATED_FLAG);
    if (migrated === '1') return false;

    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (!raw) {
      await AsyncStorage.setItem(MIGRATED_FLAG, '1');
      return false;
    }

    const parsed = JSON.parse(raw) as Record<string, Record<string, LegacyEntry>>;
    if (typeof parsed !== 'object') {
      await AsyncStorage.setItem(MIGRATED_FLAG, '1');
      return false;
    }

    let count = 0;
    for (const [bucket, entries] of Object.entries(parsed)) {
      const ns = BUCKET_TO_NAMESPACE[bucket] ?? bucket.toUpperCase().replace(/ /g, '_');
      if (typeof entries !== 'object') continue;
      for (const [key, entry] of Object.entries(entries)) {
        if (!entry?.data) continue;
        try {
          const ttlMs = entry.expiresAt != null ? entry.expiresAt - entry.fetchedAt : undefined;
          await responseCache.setToResponseCache(ns, key, entry.data, undefined, {
            fetchedAt: entry.fetchedAt,
            softExpiresAt: ttlMs != null ? entry.fetchedAt + ttlMs : undefined,
            hardExpiresAt: entry.expiresAt,
          });
          count++;
        } catch (e) {
          cacheWarn('migration skip entry', ns, key, e);
        }
      }
    }

    await AsyncStorage.setItem(MIGRATED_FLAG, '1');
    if (count > 0) recordCacheMetric('legacy_cache_migrated', { delta: count });
    cacheLog('migration done', count, 'entries');
    return true;
  } catch (e) {
    cacheWarn('migration failed', e);
    return false;
  }
}
