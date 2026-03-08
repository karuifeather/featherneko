/**
 * Debug logging for cache system. Off by default; call setCacheLogging(true) when debugging.
 */

let enabled = false;

export function setCacheLogging(on: boolean): void {
  enabled = on;
}

export function cacheLog(message: string, ...args: unknown[]): void {
  if (enabled) {
    console.log(`cache: ${message}`, ...args);
  }
}

export function cacheWarn(message: string, ...args: unknown[]): void {
  if (enabled) {
    console.warn(`cache: ${message}`, ...args);
  }
}
