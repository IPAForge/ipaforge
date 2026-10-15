import { ErrorCode, isErrorCode } from '@kernel/errors/codes.ts'
import { compact } from '@kernel/objects/compact.ts'

export type ErrorData = Readonly<Record<string, unknown>>

/** Plain-object form of an error, safe to send over RPC (structured clone / JSON). */
export type SerializedError = {
  readonly name: string
  readonly message: string
  readonly code?: ErrorCode
  readonly data?: ErrorData
  readonly cause?: SerializedError
}

export type LoadstarErrorOptions = {
  readonly cause?: unknown
  readonly data?: ErrorData
  /** Developer-facing detail. User-facing text comes from the code via i18n, never from here. */
  readonly message?: string
}

/** The only error type that crosses package boundaries. */
export class LoadstarError extends Error {
  override readonly name = 'LoadstarError'
  readonly code: ErrorCode
  readonly data: ErrorData | undefined

  constructor(code: ErrorCode, options: LoadstarErrorOptions = {}) {
    super(
      options.message ?? code,
      options.cause === undefined ? undefined : { cause: options.cause }
    )
    this.code = code
    this.data = options.data
  }

  toJSON(): SerializedError {
    return serializeError(this)
  }

  static fromJSON(json: SerializedError): LoadstarError {
    const cause = json.cause ? deserializeCause(json.cause) : undefined

    return new LoadstarError(
      json.code ?? ErrorCode.Unexpected,
      compact({ message: json.message, cause, data: json.data })
    )
  }
}

export const isLoadstarError = (value: unknown): value is LoadstarError =>
  value instanceof LoadstarError

/**
 * Normalise anything that was thrown into a LoadstarError, keeping the original as `cause`.
 * Aborts are recognised so cancellation never surfaces as an "unexpected" failure.
 */
export const toLoadstarError = (
  error: unknown,
  fallbackCode: ErrorCode = ErrorCode.Unexpected
): LoadstarError => {
  if (isLoadstarError(error)) return error
  if (isAbortError(error))
    return new LoadstarError(ErrorCode.Aborted, { cause: error })
  return new LoadstarError(fallbackCode, {
    cause: error,
    message: describe(error)
  })
}

const ABORT_ERROR_NAMES: ReadonlySet<unknown> = new Set([
  'AbortError',
  'TimeoutError'
])

export const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  ABORT_ERROR_NAMES.has(error.name)

const MAX_CAUSE_DEPTH = 8

/** A LoadstarError's code, or a foreign error's `code` when it is a catalogued one. */
const codeOf = (error: Error): ErrorCode | undefined => {
  if (error instanceof LoadstarError) return error.code
  return 'code' in error && isErrorCode(error.code) ? error.code : undefined
}

const serializeError = (error: unknown, depth = 0): SerializedError => {
  if (!(error instanceof Error))
    return { name: typeof error, message: describe(error) }
  const hasCause = error.cause !== undefined && depth < MAX_CAUSE_DEPTH

  return compact({
    name: error.name,
    message: error.message,
    code: codeOf(error),
    data: error instanceof LoadstarError ? error.data : undefined,
    cause: hasCause ? serializeError(error.cause, depth + 1) : undefined
  })
}

/** Causes that carry a code were LoadstarErrors; anything else comes back as a plain Error. */
const deserializeCause = (json: SerializedError): Error =>
  json.code ? LoadstarError.fromJSON(json) : deserializeForeign(json)

const deserializeForeign = (json: SerializedError): Error => {
  const error = new Error(
    json.message,
    json.cause ? { cause: deserializeForeign(json.cause) } : undefined
  )
  error.name = json.name
  return error
}

const describe = (value: unknown): string => {
  if (value instanceof Error) return value.message
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
