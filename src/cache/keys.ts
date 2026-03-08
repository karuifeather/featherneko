/**
 * Key patterns for the cache v2 storage layout.
 * Uses per-entry AsyncStorage keys, NOT a single giant blob.
 */

export const META_INDEX_KEY = 'featherneko_cache_meta_index_v2';
export const ENTRY_PREFIX = 'featherneko_cache_entry_v2';

export function entryStorageKey(namespace: string, hashedKey: string): string {
  return `${ENTRY_PREFIX}:${namespace}:${hashedKey}`;
}
