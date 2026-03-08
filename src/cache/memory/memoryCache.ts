/**
 * In-memory LRU cache. Bounded size, cheap reads.
 */

import type { CacheEntry } from '../types';

const DEFAULT_MAX_ENTRIES = 500;

type LRUNode = { key: string; entry: CacheEntry<unknown>; next: LRUNode | null; prev: LRUNode | null };

export class MemoryCache {
  private maxEntries: number;
  private map = new Map<string, LRUNode>();
  private head: LRUNode | null = null;
  private tail: LRUNode | null = null;

  constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  private touch(node: LRUNode): void {
    if (node === this.head) return;
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.tail) this.tail = node.prev;
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private evict(): void {
    if (!this.tail) return;
    const key = this.tail.key;
    this.map.delete(key);
    if (this.tail.prev) {
      this.tail.prev.next = null;
      this.tail = this.tail.prev;
    } else {
      this.head = null;
      this.tail = null;
    }
  }

  get(namespace: string, key: string): CacheEntry<unknown> | null {
    const k = `${namespace}:${key}`;
    const node = this.map.get(k);
    if (!node) return null;
    this.touch(node);
    return node.entry;
  }

  set(entry: CacheEntry<unknown>): void {
    const { namespace, key } = entry.meta;
    const k = `${namespace}:${key}`;
    let node = this.map.get(k);
    if (node) {
      node.entry = entry;
      this.touch(node);
      return;
    }
    while (this.map.size >= this.maxEntries) this.evict();
    node = { key: k, entry, next: this.head, prev: null };
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
    this.map.set(k, node);
  }

  remove(namespace: string, key: string): void {
    const k = `${namespace}:${key}`;
    const node = this.map.get(k);
    if (!node) return;
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;
    this.map.delete(k);
  }

  clearNamespace(namespace: string): void {
    const prefix = `${namespace}:`;
    for (const k of [...this.map.keys()]) {
      if (k.startsWith(prefix)) this.map.delete(k);
    }
    this.rebuildList();
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  private rebuildList(): void {
    this.head = null;
    this.tail = null;
    for (const node of this.map.values()) {
      node.prev = this.tail;
      node.next = null;
      if (this.tail) this.tail.next = node;
      this.tail = node;
      if (!this.head) this.head = node;
    }
  }
}
