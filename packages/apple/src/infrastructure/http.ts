// HTTP for Apple and anisette endpoints: per-request timeout, retries for transient failures only,
// and clock-skew detection from the `Date` header.

import type { AppleDeps } from "@apple/deps.ts";
import { httpErrorCode } from "@apple/domain/gsa-status.ts";
import {
  ErrorCode,
  type HttpMethod,
  isTransientHttpStatus,
  LoadstarError,
  readBody,
  retry,
  utf8DecodeLenient,
} from "@loadstar/kernel";

export interface FetchOptions {
  readonly method?: HttpMethod;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array | string;
  readonly timeoutMs?: number;
  /** Retry 429/5xx/network failures (default true). Never set for requests carrying a password check. */
  readonly retryTransient?: boolean;
  /** Accept these statuses without throwing (default: 2xx only). */
  readonly acceptStatus?: (status: number) => boolean;
  readonly signal?: AbortSignal;
  readonly maxBodyBytes?: number;
}

export interface FetchResult {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
  /** Server clock minus local clock, when the server sent a `Date` header. */
  readonly clockSkewMs?: number;
}

class TransientHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

/** Rate limits, temporary server failures, timeouts and network drops (adapters report those as `net.offline`). */
const isTransient = (error: unknown): boolean =>
  error instanceof TransientHttpError ||
  (error instanceof LoadstarError && error.code === ErrorCode.Offline) ||
  (error instanceof Error && error.name === "TimeoutError");

const headerValue = (headers: Readonly<Record<string, string>>, name: string): string | undefined => {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === wanted) return value;
  return undefined;
};

export const fetchApple = async (deps: AppleDeps, url: string, options: FetchOptions = {}): Promise<FetchResult> => {
  const accept = options.acceptStatus ?? ((status: number) => status >= 200 && status < 300);
  const timeoutMs = options.timeoutMs ?? deps.config.timeouts.requestMs;

  const attempt = async (): Promise<FetchResult> => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const response = await deps.http.request({
      method: options.method ?? "GET",
      url,
      signal,
      ...(options.headers ? { headers: options.headers } : {}),
      ...(options.body === undefined ? {} : { body: options.body }),
    });
    const body = await readBody(response, options.maxBodyBytes);
    if (!accept(response.status)) {
      if (isTransientHttpStatus(response.status)) throw new TransientHttpError(response.status);
      throw new LoadstarError(httpErrorCode(response.status), {
        message: `${options.method ?? "GET"} ${new URL(url).host}${new URL(url).pathname} → HTTP ${response.status}`,
        data: { status: response.status, host: new URL(url).host, body: utf8DecodeLenient(body.subarray(0, 512)) },
      });
    }
    const date = headerValue(response.headers, "date");
    const serverTime = date ? Date.parse(date) : Number.NaN;
    return {
      status: response.status,
      headers: response.headers,
      body,
      ...(Number.isFinite(serverTime) ? { clockSkewMs: serverTime - deps.clock.now().getTime() } : {}),
    };
  };

  try {
    return await retry(attempt, {
      attempts: options.retryTransient === false ? 1 : deps.config.retryAttempts,
      retryOn: isTransient,
      sleep: deps.sleep,
      random: deps.random,
      onRetry: (error, n, delayMs) =>
        deps.logger.warn("retrying request", { host: new URL(url).host, attempt: n, delayMs, cause: error }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (error instanceof TransientHttpError) {
      throw new LoadstarError(httpErrorCode(error.status), {
        message: `${new URL(url).host} answered HTTP ${error.status}`,
        data: { status: error.status, host: new URL(url).host },
      });
    }
    if (error instanceof LoadstarError) throw error;
    throw new LoadstarError(ErrorCode.Offline, { cause: error, data: { host: new URL(url).host } });
  }
};

export const header = headerValue;
