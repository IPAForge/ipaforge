// A run's events reduced into what the run view shows: every step with its label key, state, progress and detail,
// the overall progress, the question waiting for an answer, and how the run ended. The events themselves are
// reduced in `utils/reduce-run-event.ts`; these are the changes the store makes around them.
import { ErrorCode, type LoadstarError } from '@loadstar/kernel'
import type { RemoteCheckpoint, RemoteResult } from '@loadstar/rpc'
import type { RunView } from '@ui/state/active-run/types.ts'
import { withStepsIn } from '@ui/state/active-run/utils/steps.ts'

const PERCENT = 100

/** A new run, or one resuming: the earlier run's steps stay on screen until the Engine lists them again. */
export const startingView = (previous?: RunView): RunView => ({
  status: 'starting',
  steps: previous?.steps ?? [],
  fraction: previous?.fraction ?? 0
})

/**
 * The answer went to the Engine: the step it waited on is running again, and the question stays on screen, busy,
 * until the Engine's next event (the step goes on, or the question comes back after a wrong answer).
 */
export const answeredView = (view: RunView): RunView => ({
  ...withStepsIn(view, ['waiting'], 'active'),
  status: 'answering'
})

const stoppedView = (view: RunView, checkpoint: RemoteCheckpoint): RunView => ({
  ...withStepsIn(view, ['active', 'waiting', 'failed'], 'pending'),
  status: 'cancelled',
  prompt: undefined,
  checkpoint
})

/** How the run ended. Declining a question stops the run like Cancel does: it can be resumed. */
export const finishedView = (
  view: RunView,
  result: RemoteResult<unknown>
): RunView => {
  if (result.status === 'completed')
    return { ...view, status: 'completed', fraction: 1, prompt: undefined }
  if (
    result.status === 'cancelled' ||
    result.error.code === ErrorCode.PromptCancelled
  )
    return stoppedView(view, result.checkpoint)
  return {
    ...withStepsIn(view, ['active', 'waiting'], 'failed'),
    status: 'failed',
    prompt: undefined,
    failure: { error: result.error, stepId: result.failedStep },
    checkpoint: result.checkpoint
  }
}

/** The run could not start or finish (the channel closed): it fails where it was, without a checkpoint. */
export const brokenView = (view: RunView, error: LoadstarError): RunView => {
  const current =
    view.steps.find((step) => step.state === 'active') ??
    view.steps.find((step) => step.state === 'waiting')

  return {
    ...withStepsIn(view, ['active', 'waiting'], 'failed'),
    status: 'failed',
    prompt: undefined,
    failure: { error, stepId: current?.id ?? '' },
    checkpoint: undefined
  }
}

/** The overall progress as a whole percentage, for a progress bar's value. */
export const overallPercent = (view: RunView): number =>
  Math.round(view.fraction * PERCENT)

export const isRunActive = (view: RunView | undefined): boolean =>
  view?.status === 'starting' ||
  view?.status === 'running' ||
  view?.status === 'waiting' ||
  view?.status === 'answering'
