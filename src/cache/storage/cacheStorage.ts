/**
 * Abstract interface for persistent cache storage.
 * Implementations use per-entry keys, never a single giant blob.
 */

import type { CacheEntry } from '../types';

export interface CacheStorage {
  get(namespace: string, key: string): Promise<CacheEntry<unknown> | null>;
  set(entry: CacheEntry<unknown>): Promise<void>;
  remove(namespace: string, key: string): Promise<void>;
  getIndex(): Promise<IndexEntry[]>;
  updateIndex(entries: IndexEntry[]): Promise<void>;
}

export interface IndexEntry {
  namespace: string;
  key: string;
  hashedKey: string;
  softExpiresAt?: number;
  hardExpiresAt?: number;
  lastAccessedAt: number;
  accessCount: number;
  negative?: boolean;
  immutable?: boolean;
}
