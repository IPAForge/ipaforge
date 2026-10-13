import { ErrorCode, isErrorCode } from "@kernel/errors/codes.ts";

export type ErrorData = Readonly<Record<string, unknown>>;

/** Plain-object form of an error, safe to send over RPC (structured clone / JSON). */
export interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly code?: ErrorCode;
  readonly data?: ErrorData;
  readonly cause?: SerializedError;
}

export interface LoadstarErrorOptions {
  readonly cause?: unknown;
  readonly data?: ErrorData;
  /** Developer-facing detail. User-facing text comes from the code via i18n, never from here. */
  readonly message?: string;
}

/** The only error type that crosses package boundaries. */
export class LoadstarError extends Error {
  override readonly name = "LoadstarError";
  readonly code: ErrorCode;
  readonly data: ErrorData | undefined;

  constructor(code: ErrorCode, options: LoadstarErrorOptions = {}) {
    super(options.message ?? code, options.cause === undefined ? undefined : { cause: options.cause });
    this.code = code;
    this.data = options.data;
  }

  toJSON(): SerializedError {
    return serializeError(this);
  }

  static fromJSON(json: SerializedError): LoadstarError {
    const options: { cause?: unknown; data?: ErrorData; message: string } = { message: json.message };
    if (json.cause)
      options.cause = json.cause.code ? LoadstarError.fromJSON(json.cause) : deserializeForeign(json.cause);
    if (json.data) options.data = json.data;
    return new LoadstarError(json.code ?? ErrorCode.Unexpected, options);
  }
}

export const isLoadstarError = (value: unknown): value is LoadstarError => value instanceof LoadstarError;

/**
 * Normalise anything that was thrown into a LoadstarError, keeping the original as `cause`.
 * Aborts are recognised so cancellation never surfaces as an "unexpected" failure.
 */
export const toLoadstarError = (error: unknown, fallbackCode: ErrorCode = ErrorCode.Unexpected): LoadstarError => {
  if (isLoadstarError(error)) return error;
  if (isAbortError(error)) return new LoadstarError(ErrorCode.Aborted, { cause: error });
  return new LoadstarError(fallbackCode, { cause: error, message: describe(error) });
};

export const isAbortError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    ((error as { name: unknown }).name === "AbortError" || (error as { name: unknown }).name === "TimeoutError")
  );
};

const MAX_CAUSE_DEPTH = 8;

const serializeError = (error: unknown, depth = 0): SerializedError => {
  if (!(error instanceof Error)) return { name: typeof error, message: describe(error) };

  const result: { -readonly [K in keyof SerializedError]: SerializedError[K] } = {
    name: error.name,
    message: error.message,
  };
  if (error instanceof LoadstarError) {
    result.code = error.code;
    if (error.data) result.data = error.data;
  } else if ("code" in error && isErrorCode(error.code)) {
    result.code = error.code;
  }
  if (error.cause !== undefined && depth < MAX_CAUSE_DEPTH) result.cause = serializeError(error.cause, depth + 1);
  return result;
};

const deserializeForeign = (json: SerializedError): Error => {
  const error = new Error(json.message, json.cause ? { cause: deserializeForeign(json.cause) } : undefined);
  error.name = json.name;
  return error;
};

const describe = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};
