/**
 * Hash utility for storage keys. Long logical keys become fixed-length hashes.
 */

/** Simple non-crypto hash for cache keys. Fast, deterministic. */
export function hashKey(key: string): string {
  let h = 0;
  const str = key;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h; // truncate to 32-bit
  }
  return Math.abs(h).toString(36);
}

/** For very long keys, use hash; for short keys, use safe prefix. Max 80 chars. */
export function safeStorageKey(prefix: string, logicalKey: string, maxLogicalLen = 60): string {
  const safe = logicalKey.replace(/[:/\\]/g, '_').slice(0, maxLogicalLen);
  if (safe.length < logicalKey.length) {
    return `${prefix}:${hashKey(logicalKey)}`;
  }
  return `${prefix}:${safe}`;
}
