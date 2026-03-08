/**
 * Per-entry AsyncStorage implementation. No single blob.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CacheEntry } from '../types';
import type { CacheStorage, IndexEntry } from './cacheStorage';
import { META_INDEX_KEY, entryStorageKey } from '../keys';
import { hashKey } from '../utils/hashing';
import { safeStringify, safeParse } from '../utils/serialization';
import { cacheWarn } from '../utils/logger';

const SCHEMA_VERSION = 1;

export class AsyncStorageCacheStorage implements CacheStorage {
  async get(namespace: string, key: string): Promise<CacheEntry<unknown> | null> {
    const hashed = hashKey(key);
    const storageKey = entryStorageKey(namespace, hashed);
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = safeParse<CacheEntry<unknown>>(raw, null as CacheEntry<unknown> | null);
      if (!parsed?.meta) return null;
      if (parsed.meta.namespace !== namespace || parsed.meta.key !== key) return null;
      return parsed;
    } catch (e) {
      cacheWarn('asyncStorage get error', namespace, key, e);
      return null;
    }
  }

  async set(entry: CacheEntry<unknown>): Promise<void> {
    const { namespace, key } = entry.meta;
    const hashed = hashKey(key);
    const storageKey = entryStorageKey(namespace, hashed);
    try {
      const toStore = { ...entry, meta: { ...entry.meta, version: SCHEMA_VERSION } };
      await AsyncStorage.setItem(storageKey, safeStringify(toStore));
    } catch (e) {
      cacheWarn('asyncStorage set error', namespace, key, e);
      throw e;
    }
  }

  async remove(namespace: string, key: string): Promise<void> {
    const hashed = hashKey(key);
    const storageKey = entryStorageKey(namespace, hashed);
    try {
      await AsyncStorage.removeItem(storageKey);
    } catch (e) {
      cacheWarn('asyncStorage remove error', namespace, key, e);
    }
  }

  async getIndex(): Promise<IndexEntry[]> {
    try {
      const raw = await AsyncStorage.getItem(META_INDEX_KEY);
      if (!raw) return [];
      const parsed = safeParse<IndexEntry[]>(raw, []);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async updateIndex(entries: IndexEntry[]): Promise<void> {
    try {
      await AsyncStorage.setItem(META_INDEX_KEY, safeStringify(entries));
    } catch (e) {
      cacheWarn('asyncStorage index update error', e);
    }
  }
}
