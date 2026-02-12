import pRetry, { type Options as PRetryOptions } from 'p-retry';

/**
 * Retry configuration options.
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 3).
   */
  retries?: number;

  /**
   * Minimum delay between retries in ms (default: 1000).
   */
  minTimeout?: number;

  /**
   * Maximum delay between retries in ms (default: 10000).
   */
  maxTimeout?: number;

  /**
   * Exponential backoff factor (default: 2).
   */
  factor?: number;

  /**
   * Whether to randomize delay (jitter) (default: true).
   */
  randomize?: boolean;

  /**
   * Callback invoked on each retry attempt.
   */
  onFailedAttempt?: (error: Error, attempt: number) => void | Promise<void>;
}

/**
 * Execute a function with retry logic and exponential backoff.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the function result
 *
 * @example
 * ```ts
 * const result = await retryWithBackoff(
 *   async () => fetchData(),
 *   { retries: 3, minTimeout: 1000 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    minTimeout = 1000,
    maxTimeout = 10000,
    factor = 2,
    randomize = true,
    onFailedAttempt,
  } = options;

  const pRetryOptions: PRetryOptions = {
    retries,
    minTimeout,
    maxTimeout,
    factor,
    randomize,
    onFailedAttempt: onFailedAttempt
      ? (error) => {
          void onFailedAttempt(error, error.attemptNumber);
        }
      : undefined,
  };

  return pRetry(fn, pRetryOptions);
}

/**
 * Check if an error is retryable (e.g., network errors, rate limits).
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const retryableMessages = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'timeout',
    'rate limit',
    '429',
    '503',
    '504',
  ];

  const message = error.message.toLowerCase();
  return retryableMessages.some((msg) => message.includes(msg.toLowerCase()));
}
