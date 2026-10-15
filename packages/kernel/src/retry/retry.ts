// Retry with exponential backoff and jitter. Callers decide which failures are worth retrying.

export interface RetryOptions {
  /** Total attempts, including the first (default 4). */
  readonly attempts?: number;
  /** First delay (default 500 ms); doubles each attempt up to `maxMs`. */
  readonly baseMs?: number;
  readonly maxMs?: number;
  /** Share of each delay that is randomised, 0–1 (default 0.5). */
  readonly jitter?: number;
  /** Return true to retry after `error` (default: never). */
  readonly retryOn?: (error: unknown, attempt: number) => boolean;
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  readonly random?: () => number;
  readonly signal?: AbortSignal;
  readonly onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const defaultSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

/** Delay before retry number `attempt` (1-based). */
export const backoffDelay = (
  attempt: number,
  options: RetryOptions = {},
  random: () => number = Math.random,
): number => {
  const base = options.baseMs ?? 500;
  const max = options.maxMs ?? 10_000;
  const jitter = Math.min(Math.max(options.jitter ?? 0.5, 0), 1);
  const exponential = Math.min(max, base * 2 ** (attempt - 1));
  return Math.round(exponential * (1 - jitter + jitter * random()));
};

export const retry = async <T>(run: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> => {
  const attempts = Math.max(1, options.attempts ?? 4);
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  for (let attempt = 1; ; attempt++) {
    options.signal?.throwIfAborted();
    try {
      return await run(attempt);
    } catch (error) {
      if (attempt >= attempts || !(options.retryOn?.(error, attempt) ?? false)) throw error;
      const delay = backoffDelay(attempt, options, random);
      options.onRetry?.(error, attempt, delay);
      await sleep(delay, options.signal);
    }
  }
};

/** HTTP statuses that are worth retrying: rate limits and temporary server failures. */
export const isTransientHttpStatus = (status: number): boolean =>
  status === 429 || status === 502 || status === 503 || status === 504;
