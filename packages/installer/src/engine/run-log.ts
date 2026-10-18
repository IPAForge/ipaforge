// A run's story in the log: started, each step done or failed (with what it did), retries, questions, and how it
// ended. Progress ticks are left out; they would bury the rest. Every line carries the flow's id.
import type { RunEvent } from '@installer/engine/types.ts'
import type { PipelineResult } from '@installer/pipeline/types.ts'
import type { Logger } from '@ipaforge/kernel'

type EventLogger = (logger: Logger, event: never) => void

const handlers = {
  'run-started': (logger, event: Extract<RunEvent, { type: 'run-started' }>) =>
    logger.info('run started', {
      steps: event.steps.length,
      alreadyDone: event.completed.length
    }),
  'step-started': (
    logger,
    event: Extract<RunEvent, { type: 'step-started' }>
  ) =>
    logger.debug('step started', {
      step: event.stepId,
      index: event.index + 1,
      total: event.total
    }),
  'step-progress': () => {},
  'step-retrying': (
    logger,
    event: Extract<RunEvent, { type: 'step-retrying' }>
  ) =>
    logger.warn('step failed, retrying', {
      step: event.stepId,
      attempt: event.attempt,
      inMs: event.delayMs,
      code: event.code
    }),
  'step-detail': (logger, event: Extract<RunEvent, { type: 'step-detail' }>) =>
    logger.info('step result', { step: event.stepId, ...event.detail }),
  'step-skipped': (
    logger,
    event: Extract<RunEvent, { type: 'step-skipped' }>
  ) => logger.debug('step already done', { step: event.stepId }),
  'step-completed': (
    logger,
    event: Extract<RunEvent, { type: 'step-completed' }>
  ) => logger.info('step done', { step: event.stepId }),
  'step-failed': (logger, event: Extract<RunEvent, { type: 'step-failed' }>) =>
    logger.error('step failed', {
      step: event.stepId,
      code: event.error.code,
      error: event.error
    }),
  progress: () => {},
  prompt: (logger, event: Extract<RunEvent, { type: 'prompt' }>) =>
    logger.info('waiting for an answer', { question: event.request.kind })
} satisfies Record<RunEvent['type'], EventLogger>

export const logRunEvent = (logger: Logger, event: RunEvent): void =>
  (handlers[event.type] as (logger: Logger, event: RunEvent) => void)(
    logger,
    event
  )

export const logRunResult = <S>(
  logger: Logger,
  result: PipelineResult<S>
): void => {
  if (result.status === 'completed') logger.info('run completed')
  else if (result.status === 'cancelled') logger.info('run cancelled')
  else
    logger.error('run failed', {
      step: result.failedStep,
      code: result.error.code
    })
}
