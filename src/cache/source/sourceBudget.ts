/**
 * Re-exports source health as "source budget" for integration.
 * Can be extended with token-bucket or request throttling later.
 */

export {
  markSuccess,
  markFailure,
  markRateLimited,
  getSourceHealth,
} from './sourceHealth';
