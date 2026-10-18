// How the runner reads a step's failure: retry it, treat it as a cancellation, or report it.

import { TRANSIENT } from '@installer/pipeline/constants.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export const isTransient = (error: unknown): boolean =>
  error instanceof IPAForgeError && TRANSIENT.has(error.code)

export const isAbort = (error: unknown, signal: AbortSignal): boolean =>
  signal.aborted ||
  (error instanceof IPAForgeError && error.code === ErrorCode.Aborted)

/** Keeps a `IPAForgeError` as is; wraps anything else as `installer.step_failed` for `stepId`. */
export const asIPAForgeError = (
  error: unknown,
  stepId: string
): IPAForgeError =>
  error instanceof IPAForgeError
    ? error
    : new IPAForgeError(ErrorCode.StepFailed, {
        cause: error,
        data: { step: stepId }
      })
