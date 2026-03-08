/**
 * ID mapping entity store. AniList/MAL/Kitsu/provider identity mappings.
 * Uses the cache system with ID_MAPPING policy (long-lived, negative cache).
 */

import * as cacheService from '@/cache/cacheService';

const NAMESPACE = 'ID_MAPPING';

export interface MappingEntity {
  malId?: number;
  anilistId?: number;
  kitsuId?: string;
  providerIds?: Record<string, string>;
  lastVerifiedAt?: number;
}

function mappingKey(source: string, id: string | number): string {
  return `${source}:${id}`;
}

export async function getMapping(
  source: 'mal' | 'anilist' | 'kitsu',
  id: string | number
): Promise<MappingEntity | null> {
  const key = mappingKey(source, id);
  const result = await cacheService.get<MappingEntity>(NAMESPACE, key);
  if (!result.hit || !result.data) return null;
  return result.data;
}

export async function setMapping(
  source: 'mal' | 'anilist' | 'kitsu',
  id: string | number,
  mapping: MappingEntity
): Promise<void> {
  const key = mappingKey(source, id);
  await cacheService.set(NAMESPACE, key, {
    ...mapping,
    lastVerifiedAt: Date.now(),
  });
}

export async function setNegativeMapping(
  source: 'mal' | 'anilist' | 'kitsu',
  id: string | number,
  reason?: string
): Promise<void> {
  const key = mappingKey(source, id);
  await cacheService.setNegative(NAMESPACE, key, reason);
}
