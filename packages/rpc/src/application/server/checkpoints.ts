// Checkpoints of failed or cancelled runs, kept on the Engine's side: their state holds open files, and the UI must
// not be able to hand the Engine a state of its own making. The UI resumes by reference.
import type { CheckpointStore, Kept } from '@rpc/application/server/types.ts'
import { unknownReference } from '@rpc/domain/errors.ts'

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
