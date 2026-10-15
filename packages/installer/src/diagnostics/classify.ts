// Turns whatever a flow threw into a catalogued code and its recovery actions. Presentation is the UI's job.
import { RECOVERY_CATALOGUE } from '@installer/diagnostics/catalogue.ts'
import type { RecoveryAction } from '@installer/diagnostics/recovery.ts'
import {
  ErrorCode,
  isAbortError,
  isErrorCode,
  LoadstarError
} from '@loadstar/kernel'

export type Diagnosis = {
  readonly code: ErrorCode
  readonly recovery: readonly RecoveryAction[]
}

/** Errors that only say "this step failed": the cause, when it carries a code, is the real diagnosis. */
const WRAPPERS: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.StepFailed,
  ErrorCode.Unexpected
])

const MAX_DEPTH = 8

/** A catalogued code on a foreign error (`{ code: "net.offline" }`), if any. */
const foreignCode = (error: unknown): ErrorCode | undefined => {
  if (isAbortError(error)) return ErrorCode.Aborted
  const code =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown }).code
      : undefined

  return isErrorCode(code) ? code : undefined
}

const codeOf = (error: unknown, depth = 0): ErrorCode => {
  if (!(error instanceof LoadstarError))
    return foreignCode(error) ?? ErrorCode.Unexpected
  if (
    !WRAPPERS.has(error.code) ||
    error.cause === undefined ||
    depth >= MAX_DEPTH
  )
    return error.code
  const inner = codeOf(error.cause, depth + 1)

  return inner === ErrorCode.Unexpected ? error.code : inner
}

export const classify = (error: unknown): Diagnosis => {
  const code = codeOf(error)

  return { code, recovery: RECOVERY_CATALOGUE[code] }
}
