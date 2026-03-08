/**
 * Validates required env vars at runtime. Add checks for keys you need.
 * Do not import secrets into client bundles if they must stay server-only.
 */
export function validateEnv(): { ok: boolean; missing: string[] } {
  const required = ['ANIMEAPI_URL'];
  const missing = required.filter((key) => {
    const val = process.env[key];
    return val === undefined || val === '';
  });
  if (__DEV__ && missing.length > 0) {
    console.warn('[env] Missing or empty:', missing.join(', '));
  }
  return { ok: missing.length === 0, missing };
}
