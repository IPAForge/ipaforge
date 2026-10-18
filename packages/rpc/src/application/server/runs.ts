// The runs the UI started, by the id it chose: each run's events and outcome go back over the channel, and answers,
// declines and cancels reach its handle. A run is forgotten when it ends.
import type { RunHandle } from '@ipaforge/installer'
import { compact, toIPAForgeError } from '@ipaforge/kernel'
import type {
  ActiveRun,
  RunRegistry,
  RunRegistryDeps,
  StartRequest
} from '@rpc/application/server/types.ts'
import { wireEvent, wireResult } from '@rpc/application/server/wire-run.ts'
import { runIdInUse, unknownReference } from '@rpc/domain/errors.ts'
import type { Command } from '@rpc/domain/protocol/types.ts'

export const createRunRegistry = ({
  startCommand,
  checkpoints,
  send
}: RunRegistryDeps): RunRegistry => {
  const runs = new Map<string, ActiveRun>()

  const activeRun = (runId: string): ActiveRun => {
    const run = runs.get(runId)
    if (!run) throw unknownReference('run', runId)
    return run
  }

  const startedHandle = (runId: string): RunHandle<unknown> => {
    const { handle } = activeRun(runId)
    if (!handle) throw unknownReference('run', runId)
    return handle
  }

  const follow = (
    runId: string,
    command: Command,
    handle: RunHandle<unknown>
  ): void => {
    const unsubscribe = handle.subscribe((event) =>
      send({ type: 'run-event', runId, event: wireEvent(event) })
    )
    void handle.result
      .then(
        (result) =>
          send({
            type: 'run-result',
            runId,
            result: wireResult(result, command, checkpoints)
          }),
        (error: unknown) =>
          send({
            type: 'run-error',
            runId,
            error: toIPAForgeError(error).toJSON()
          })
      )
      .finally(() => {
        unsubscribe()
        runs.delete(runId)
      })
  }

  const launch = async (
    { runId, call, resume }: StartRequest,
    run: ActiveRun
  ): Promise<void> => {
    const { signal } = run.controller
    const checkpoint =
      resume === undefined ? undefined : checkpoints.get(resume, call.command)
    run.handle = await startCommand(
      call,
      compact({ signal, resume: checkpoint }),
      signal
    )
    if (resume !== undefined) checkpoints.forget(resume)
    follow(runId, call.command, run.handle)
  }

  return {
    start: async (request) => {
      if (runs.has(request.runId)) throw runIdInUse(request.runId)
      const run: ActiveRun = { controller: new AbortController() }
      runs.set(request.runId, run)
      try {
        await launch(request, run)
      } catch (error) {
        runs.delete(request.runId)
        throw error
      }
    },
    answer: (runId, answer) => startedHandle(runId).answer(answer),
    decline: (runId) => startedHandle(runId).decline(),
    cancel: (runId) => activeRun(runId).controller.abort(),
    cancelAll: () => {
      for (const run of runs.values()) run.controller.abort()
    }
  }
}
