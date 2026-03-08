/**
 * Resolve streaming API base URL from .env (AnimeAPI only).
 */
import { ANIMEAPI_URL } from '@env';

const envByKey: Record<string, string | undefined> = {
  ANIMEAPI_URL: ANIMEAPI_URL ?? undefined,
};

/** Get base URL for a streaming API from env. Trims and strips trailing slash. */
export function getStreamingBaseUrl(envKey: string): string {
  const raw = envByKey[envKey] ?? '';
  const url = typeof raw === 'string' ? raw.trim() : '';
  return url ? url.replace(/\/+$/, '') : '';
}
