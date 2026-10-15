// The runs the UI started, by the id it chose: each run's events and outcome go back over the channel, and answers,
// declines and cancels reach its handle. A run is forgotten when it ends.
import type { RunHandle } from '@loadstar/installer'
import { compact, toLoadstarError } from '@loadstar/kernel'
import type { CheckpointStore } from '@rpc/application/server/checkpoints.ts'
import type { StartCommand } from '@rpc/application/server/commands.ts'
import { wireEvent, wireResult } from '@rpc/application/server/wire-run.ts'
import { runIdInUse, unknownReference } from '@rpc/domain/errors.ts'
import type { MessageBody } from '@rpc/domain/protocol/messages.ts'
import type { Command, Request } from '@rpc/domain/protocol/requests.ts'

type StartRequest = Extract<Request, { type: 'start' }>

type ActiveRun = {
  readonly controller: AbortController
  /** Set once the command has started (its inputs may take a while: an IPA download). */
  handle?: RunHandle<unknown>
}

export type RunRegistryDeps = {
  readonly startCommand: StartCommand
  readonly checkpoints: CheckpointStore
  readonly send: (message: MessageBody) => void
}

export type RunRegistry = {
  start(request: StartRequest): Promise<void>
  answer(runId: string, answer: unknown): void
  decline(runId: string): void
  cancel(runId: string): void
  /** Cancels every run (the channel closed). */
  cancelAll(): void
}

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
            error: toLoadstarError(error).toJSON()
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
