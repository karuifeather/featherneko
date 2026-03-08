/**
 * Safe JSON serialization/deserialization with corruption handling.
 */

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (e) {
    throw new Error(`Cache serialize failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function safeParse<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed != null ? parsed : fallback;
  } catch {
    return fallback;
  }
}
