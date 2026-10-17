// How the runner reads a step's failure: retry it, treat it as a cancellation, or report it.

import { TRANSIENT } from '@installer/pipeline/constants.ts'
import { ErrorCode, LoadstarError } from '@loadstar/kernel'

export const isTransient = (error: unknown): boolean =>
  error instanceof LoadstarError && TRANSIENT.has(error.code)

export const isAbort = (error: unknown, signal: AbortSignal): boolean =>
  signal.aborted ||
  (error instanceof LoadstarError && error.code === ErrorCode.Aborted)

/** Keeps a `LoadstarError` as is; wraps anything else as `installer.step_failed` for `stepId`. */
export const asLoadstarError = (
  error: unknown,
  stepId: string
): LoadstarError =>
  error instanceof LoadstarError
    ? error
    : new LoadstarError(ErrorCode.StepFailed, {
        cause: error,
        data: { step: stepId }
      })
