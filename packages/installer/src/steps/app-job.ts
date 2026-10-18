// Per-app steps work on one entry of `state.apps`: these read it and produce the state update for it.
import type { AppJob, InstallState } from '@installer/domain/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

/** Step id for app `index`: `inspect-0`, `sign-1`, … (stable, so checkpoints resume at the right app). */
export const appStepId = (base: string, index: number): string =>
  `${base}-${index}`

export const jobAt = (state: InstallState, index: number): AppJob => {
  const job = state.apps[index]
  if (!job)
    throw new IPAForgeError(ErrorCode.Unexpected, {
      message: `no app at index ${index}`
    })
  return job
}

/** The state update that merges `patch` into app `index`. */
export const updateJob = (
  state: InstallState,
  index: number,
  patch: Partial<AppJob>
): Partial<InstallState> => ({
  apps: state.apps.map((job, at) => (at === index ? { ...job, ...patch } : job))
})

/** A field an earlier step must have produced; missing means the flow was assembled wrongly. */
export const required = <T>(value: T | undefined, what: string): T => {
  if (value !== undefined) return value
  throw new IPAForgeError(ErrorCode.Unexpected, {
    message: `${what} is missing; an earlier step did not run`
  })
}
