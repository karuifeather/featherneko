/**
 * Clock abstraction for cache timestamps. Allows testing and time injection.
 */

export function now(): number {
  return Date.now();
}
