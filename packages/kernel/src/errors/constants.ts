/** `Error.name`s that mean the operation was aborted or timed out. */
export const ABORT_ERROR_NAMES: ReadonlySet<unknown> = new Set([
  'AbortError',
  'TimeoutError'
])
