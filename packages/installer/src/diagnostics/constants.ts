import { ErrorCode } from '@loadstar/kernel'

/** Errors that only say "this step failed": the cause, when it carries a code, is the real diagnosis. */
export const WRAPPERS: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.StepFailed,
  ErrorCode.Unexpected
])

export const MAX_DEPTH = 8
