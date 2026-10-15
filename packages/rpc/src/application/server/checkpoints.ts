// Checkpoints of failed or cancelled runs, kept on the Engine's side: their state holds open files, and the UI must
// not be able to hand the Engine a state of its own making. The UI resumes by reference.
import type { Checkpoint } from '@loadstar/installer'
import { unknownReference } from '@rpc/domain/errors.ts'
import type { RemoteCheckpoint } from '@rpc/domain/protocol/messages.ts'
import type { Command } from '@rpc/domain/protocol/requests.ts'

type Kept = {
  readonly command: Command
  readonly checkpoint: Checkpoint<unknown>
}

export type CheckpointStore = {
  keep(command: Command, checkpoint: Checkpoint<unknown>): RemoteCheckpoint
  /** The checkpoint to resume `command` from. */
  get(id: string, command: Command): Checkpoint<unknown>
  /** Called once a resumed run has started: it makes its own checkpoint if it stops again. */
  forget(id: string): void
  clear(): void
}

export const createCheckpointStore = (): CheckpointStore => {
  const kept = new Map<string, Kept>()

  return {
    keep: (command, checkpoint) => {
      const id = crypto.randomUUID()
      kept.set(id, { command, checkpoint })
      return {
        id,
        pipelineId: checkpoint.pipelineId,
        completed: [...checkpoint.completed]
      }
    },
    get: (id, command) => {
      const found = kept.get(id)
      if (found?.command !== command) throw unknownReference('checkpoint', id)
      return found.checkpoint
    },
    forget: (id) => kept.delete(id),
    clear: () => kept.clear()
  }
}
