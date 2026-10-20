import type { UpdateState } from '@rpc/domain/protocol/types.ts'

/**
 * Updating IPAForge, on either end of the update channel: the host's updater (the Electron main process), and what
 * the UI gets from it (`createUpdateClient`), or a fixed or scripted one in a browser and in tests.
 */
export type UpdateSource = {
  current(): UpdateState
  /** Every change of state, until the returned function is called. */
  subscribe(listener: (state: UpdateState) => void): () => void
  /** After a failure: check and download again. */
  retry(): void
}
