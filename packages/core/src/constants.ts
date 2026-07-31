/** Max seconds for a single `wait` / `wait_until` action. */
export const MAX_WAIT_SECONDS = 999999

/** Practical unlimited step budget for long-running tasks. */
export const INFINITE_MAX_STEPS = 999_999

/** Default agent step budget. */
export const DEFAULT_MAX_STEPS = INFINITE_MAX_STEPS

/** Default poll interval for `wait_until`. */
export const DEFAULT_POLL_INTERVAL_SECONDS = 5
