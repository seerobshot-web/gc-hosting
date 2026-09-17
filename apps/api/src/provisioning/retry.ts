/**
 * Retry-with-exponential-backoff helper for the ONE fragile hop in the
 * provisioning flow: the outbound ResellPortal mutation. ResellPortal has no
 * webhooks and a flaky wholesale API, so a transient 5xx/network blip must not
 * fail an order that would have succeeded a second later.
 *
 * Design notes:
 *  - `delaysMs` is the backoff schedule AND the attempt count: its length is
 *    the number of attempts, and `delaysMs[i]` is slept AFTER the i-th failed
 *    attempt. The default [1000, 4000, 16000] is 3 attempts with 1s/4s/16s
 *    backoff (21s of sleeping across a full exhaustion).
 *  - `sleep` is injectable purely so tests can pass a no-op and never actually
 *    wait 21 seconds. Production uses the real setTimeout-based default.
 *  - `onRetry` fires once per failed attempt (attempt number is 1-based),
 *    letting the caller log/alert without coupling this helper to a logger.
 */
export interface RetryOptions {
  /** Backoff schedule in ms; length === number of attempts. Default [1000,4000,16000]. */
  delaysMs?: number[];
  /** Sleep implementation — override in tests so no real time passes. */
  sleep?: (ms: number) => Promise<void>;
  /** Called after each failed attempt (1-based attempt number + the error). */
  onRetry?: (attempt: number, error: unknown) => void;
}

/** The production sleep: a real timer. Never used when tests inject their own. */
const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [1000, 4000, 16000];

/**
 * Run `fn`, retrying on any thrown error according to `delaysMs`. Returns the
 * first successful result. If every attempt fails, the LAST error is rethrown
 * so the caller can run its failure/alert path.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const delays = options.delaysMs ?? [...DEFAULT_RETRY_DELAYS_MS];
  const sleep = options.sleep ?? realSleep;
  const maxAttempts = delays.length;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      options.onRetry?.(attempt + 1, error);
      // Sleep after every failed attempt (including the last) — matches the
      // documented 1s/4s/16s = 21s worst-case backoff budget.
      await sleep(delays[attempt]!);
    }
  }
  throw lastError;
}
