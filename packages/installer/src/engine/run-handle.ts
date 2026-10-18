// Starting a flow and handing the caller a handle: events, prompts, cancellation and the result. The run owns its
// FlowRuntime and closes it (the device session) when it ends, however it ends.
import {
  createFlowRuntime,
  type FlowRuntime
} from '@installer/application/runtime.ts'
import { createEventLog } from '@installer/engine/event-log.ts'
import { createPromptQueue } from '@installer/engine/prompt-queue.ts'
import { logRunEvent, logRunResult } from '@installer/engine/run-log.ts'
import type {
  CommandOptions,
  RunEvent,
  RunHandle
} from '@installer/engine/types.ts'
import type { Flow } from '@installer/flows/flow.ts'
import type { PipelineResult } from '@installer/pipeline/types.ts'
import type { InstallerDeps } from '@installer/types.ts'
import { compact } from '@ipaforge/kernel'

const linkAbort = (
  controller: AbortController,
  signal: AbortSignal | undefined
): void => {
  if (signal?.aborted) controller.abort(signal.reason)
  signal?.addEventListener('abort', () => controller.abort(signal.reason), {
    once: true
  })
}

const runToEnd = async <S>(
  runtime: FlowRuntime,
  run: () => Promise<PipelineResult<S>>
) => {
  try {
    return await run()
  } finally {
    await runtime.close()
  }
}

export const startRun = <S>(
  deps: InstallerDeps,
  build: (runtime: FlowRuntime) => Flow<S>,
  options: CommandOptions<S> = {}
): RunHandle<S> => {
  const runtime = createFlowRuntime(deps)
  const controller = new AbortController()
  linkAbort(controller, options.signal)
  const events = createEventLog<RunEvent>()
  const prompts = createPromptQueue((request) =>
    events.emit({ type: 'prompt', request })
  )
  const { pipeline, initial } = build(runtime)
  const logger = deps.logger.child({
    scope: 'installer.run',
    flow: pipeline.id
  })
  events.subscribe((event) => logRunEvent(logger, event))
  const result = runToEnd(runtime, () =>
    pipeline.run(
      initial,
      compact({
        onEvent: events.emit,
        onPrompt: options.onPrompt ?? prompts.ask,
        signal: controller.signal,
        resume: options.resume
      })
    )
  )
  void result.then(
    (outcome) => logRunResult(logger, outcome),
    (error: unknown) => logger.error('run broke', { error })
  )

  return {
    subscribe: events.subscribe,
    pending: prompts.pending,
    answer: prompts.answer,
    decline: prompts.decline,
    cancel: () => controller.abort(),
    result
  }
}
