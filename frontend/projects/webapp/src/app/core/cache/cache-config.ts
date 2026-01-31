/**
 * Cache configuration constants
 *
 * BUDGET_DETAILS_BATCH_SIZE: Number of budget details to preload in parallel.
 * Set to 3 to leave HTTP connection slots for user-initiated requests.
 *
 * BUDGET_DETAILS_WAIT_TIMEOUT: Maximum time (ms) to wait for a budget detail
 * to appear in cache before giving up.
 */
export const CACHE_CONFIG = {
  BUDGET_DETAILS_BATCH_SIZE: 3,
  BUDGET_DETAILS_WAIT_TIMEOUT: 10_000,
} as const;
