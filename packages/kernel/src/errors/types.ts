import type { ErrorCode } from '@kernel/errors/codes.ts'

export type ErrorData = Readonly<Record<string, unknown>>

/** Plain-object form of an error, safe to send over RPC (structured clone / JSON). */
export type SerializedError = {
  readonly name: string
  readonly message: string
  readonly code?: ErrorCode
  readonly data?: ErrorData
  readonly cause?: SerializedError
}

export type IPAForgeErrorOptions = {
  readonly cause?: unknown
  readonly data?: ErrorData
  /** Developer-facing detail. User-facing text comes from the code via i18n, never from here. */
  readonly message?: string
}
