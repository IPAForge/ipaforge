import { describe, expect, it } from 'vitest'

import { logRunEvent, logRunResult } from '@installer/engine/run-log.ts'
import {
  createLogBuffer,
  createLogger,
  ErrorCode,
  LoadstarError
} from '@loadstar/kernel'

const logged = () => {
  const buffer = createLogBuffer()
  const logger = createLogger({ level: 'debug', sink: buffer.sink })
  const lines = () =>
    buffer.page().entries.map((e) => [e.level, e.msg, e.fields])

  return { logger, lines }
}

describe('logRunEvent', () => {
  it('tells the run as lines, without progress ticks', () => {
    const { logger, lines } = logged()
    logRunEvent(logger, {
      type: 'run-started',
      pipelineId: 'install-sidestore',
      steps: [],
      completed: ['check-device'],
      fraction: 0.1
    })
    logRunEvent(logger, { type: 'progress', fraction: 0.2 })
    logRunEvent(logger, {
      type: 'step-progress',
      stepId: 'download',
      fraction: 0.5
    })
    logRunEvent(logger, {
      type: 'step-detail',
      stepId: 'find-release',
      detail: { kind: 'release', version: '0.7.0', channel: 'stable' }
    })
    logRunEvent(logger, {
      type: 'step-retrying',
      stepId: 'download',
      attempt: 2,
      delayMs: 1000,
      code: ErrorCode.Offline
    })
    logRunEvent(logger, {
      type: 'prompt',
      request: { kind: 'apple.password' }
    } as never)
    logRunEvent(logger, {
      type: 'step-failed',
      stepId: 'install',
      error: new LoadstarError(ErrorCode.DeviceLocked, { message: 'locked' })
    })

    expect(lines().map(([level, msg]) => `${level} ${msg}`)).toEqual([
      'info run started',
      'info step result',
      'warn step failed, retrying',
      'info waiting for an answer',
      'error step failed'
    ])
    expect(lines()[1]?.[2]).toMatchObject({
      step: 'find-release',
      version: '0.7.0',
      channel: 'stable'
    })
  })
})

describe('logRunResult', () => {
  it('ends with the outcome and, for a failure, its step and code', () => {
    const { logger, lines } = logged()
    logRunResult(logger, {
      status: 'failed',
      error: new LoadstarError(ErrorCode.DeviceLocked, { message: 'locked' }),
      failedStep: 'install',
      checkpoint: { pipelineId: 'p', completed: [], state: {} }
    })
    expect(lines()).toEqual([
      ['error', 'run failed', { step: 'install', code: ErrorCode.DeviceLocked }]
    ])
  })
})
