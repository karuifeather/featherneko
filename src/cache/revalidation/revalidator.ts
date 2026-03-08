/**
 * Stale-while-revalidate: return stale immediately, trigger background refresh once per key.
 */

const revalidating = new Set<string>();

export function isRevalidating(namespace: string, key: string): boolean {
  return revalidating.has(`${namespace}:${key}`);
}

export function markRevalidating(namespace: string, key: string): boolean {
  const k = `${namespace}:${key}`;
  if (revalidating.has(k)) return false;
  revalidating.add(k);
  return true;
}

export function unmarkRevalidating(namespace: string, key: string): void {
  revalidating.delete(`${namespace}:${key}`);
}
