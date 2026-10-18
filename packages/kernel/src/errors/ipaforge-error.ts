import { ErrorCode, isErrorCode } from '@kernel/errors/codes.ts'
import { ABORT_ERROR_NAMES } from '@kernel/errors/constants.ts'
import type {
  ErrorData,
  IPAForgeErrorOptions,
  SerializedError
} from '@kernel/errors/types.ts'
import { compact } from '@kernel/objects/compact.ts'

/** The only error type that crosses package boundaries. */
export class IPAForgeError extends Error {
  override readonly name = 'IPAForgeError'
  readonly code: ErrorCode
  readonly data: ErrorData | undefined

  constructor(code: ErrorCode, options: IPAForgeErrorOptions = {}) {
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

  static fromJSON(json: SerializedError): IPAForgeError {
    const cause = json.cause ? deserializeCause(json.cause) : undefined

    return new IPAForgeError(
      json.code ?? ErrorCode.Unexpected,
      compact({ message: json.message, cause, data: json.data })
    )
  }
}

export const isIPAForgeError = (value: unknown): value is IPAForgeError =>
  value instanceof IPAForgeError

/**
 * Normalise anything that was thrown into an IPAForgeError, keeping the original as `cause`.
 * Aborts are recognised so cancellation never surfaces as an "unexpected" failure.
 */
export const toIPAForgeError = (
  error: unknown,
  fallbackCode: ErrorCode = ErrorCode.Unexpected
): IPAForgeError => {
  if (isIPAForgeError(error)) return error
  if (isAbortError(error))
    return new IPAForgeError(ErrorCode.Aborted, { cause: error })
  return new IPAForgeError(fallbackCode, {
    cause: error,
    message: describe(error)
  })
}

export const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  ABORT_ERROR_NAMES.has(error.name)

const MAX_CAUSE_DEPTH = 8

/** An IPAForgeError's code, or a foreign error's `code` when it is a catalogued one. */
const codeOf = (error: Error): ErrorCode | undefined => {
  if (error instanceof IPAForgeError) return error.code
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
    data: error instanceof IPAForgeError ? error.data : undefined,
    cause: hasCause ? serializeError(error.cause, depth + 1) : undefined
  })
}

/** Causes that carry a code were IPAForgeErrors; anything else comes back as a plain Error. */
const deserializeCause = (json: SerializedError): Error =>
  json.code ? IPAForgeError.fromJSON(json) : deserializeForeign(json)

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
