/**
 * Fetch wrapper that wires source health (markSuccess, markFailure, markRateLimited).
 * Use this for all API calls to AniList, Kitsu, AnimeAPI, and providers.
 */

import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from "axios";
import { markSuccess, markFailure, markRateLimited } from "./source/sourceHealth";
import { getSourceHealth } from "./source/sourceHealth";
import type { CacheSource } from "./types";
import { recordCacheMetric } from "./metrics";

export type SourceHealthFetchOptions = {
  source: CacheSource;
  retryAfterMs?: number;
};

/**
 * Axios-style fetch with source health integration.
 * On success: markSuccess(source)
 * On failure: markFailure(source)
 * On 429: markRateLimited(source, retryAfterMs)
 */
export async function fetchWithSourceHealth<T = unknown>(
  url: string,
  config: AxiosRequestConfig & { source?: CacheSource } = {}
): Promise<AxiosResponse<T>> {
  const { source, ...axiosConfig } = config as AxiosRequestConfig & { source?: CacheSource };
  try {
    const res = await axios.request<T>({ ...axiosConfig, url });
    if (source) {
      markSuccess(source);
      recordCacheMetric('source_success', { source });
    }
    return res;
  } catch (err) {
    const axiosErr = err as AxiosError;
    const status = axiosErr?.response?.status;
    if (source) {
      if (status === 429) {
        recordCacheMetric('source_rate_limited', { source });
        const retryAfter =
          axiosErr?.response?.headers?.["retry-after"] ??
          axiosErr?.response?.headers?.["Retry-After"];
        const retryMs =
          typeof retryAfter === "string"
            ? parseInt(retryAfter, 10) * 1000
            : typeof retryAfter === "number"
              ? retryAfter * 1000
              : 5 * 60 * 1000;
        markRateLimited(source, retryMs);
      } else {
        recordCacheMetric('source_failure', { source });
        markFailure(source, err);
      }
    }
    throw err;
  }
}

/**
 * POST JSON with source health. Convenience for GraphQL/JSON APIs.
 */
export async function postJsonWithSourceHealth<T = unknown>(
  url: string,
  body: unknown,
  config: Omit<AxiosRequestConfig, "method" | "url" | "data"> & SourceHealthFetchOptions
): Promise<AxiosResponse<T>> {
  const { source, retryAfterMs, ...rest } = config;
  return fetchWithSourceHealth<T>(url, {
    method: "POST",
    data: body,
    headers: { "Content-Type": "application/json", ...rest.headers },
    source,
    ...rest,
  } as AxiosRequestConfig & { source?: CacheSource });
}

/**
 * Fetch with stale fallback: when source is rate-limited, return cached without fetching.
 * When fetch fails and we have cached data, return cached if allowStaleOnError.
 */
export async function fetchWithStaleFallback<T>(
  getCached: () => Promise<T | null>,
  fetcher: () => Promise<T>,
  options: { source?: CacheSource; allowStaleOnError?: boolean; namespace?: string }
): Promise<T> {
  const cached = await getCached();
  if (
    options.source &&
    getSourceHealth(options.source) === "rate_limited" &&
    cached != null
  ) {
    recordCacheMetric("stale_served_while_rate_limited", {
      namespace: options.namespace,
      source: options.source,
    });
    recordCacheMetric("request_avoided_source_health", {
      namespace: options.namespace,
      source: options.source,
    });
    return cached;
  }
  try {
    return await fetcher();
  } catch (e) {
    if (cached != null && options.allowStaleOnError !== false) {
      recordCacheMetric("stale_served_on_error", {
        namespace: options.namespace,
        source: options.source,
      });
      return cached;
    }
    throw e;
  }
}
