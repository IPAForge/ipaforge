import { describe, expect, it } from 'vitest'

import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import type { RunEvent } from '@loadstar/rpc'
import {
  answeredView,
  brokenView,
  finishedView,
  overallPercent,
  type RunView,
  reduceRunEvent,
  startingView
} from '@ui/state/active-run/run-view.ts'

const CHECKPOINT = { id: 'c1', pipelineId: 'installSideStore', completed: [] }

const started = (completed: string[] = [], fraction = 0): RunEvent => ({
  type: 'run-started',
  pipelineId: 'installSideStore',
  steps: [
    { stepId: 'device', labelKey: 'install.steps.device' },
    { stepId: 'download-0', labelKey: 'install.steps.download' },
    { stepId: 'team', labelKey: 'install.steps.team' }
  ],
  completed,
  fraction
})

const reduce = (events: RunEvent[], from: RunView = startingView()) =>
  events.reduce(reduceRunEvent, from)

const states = (view: RunView) => view.steps.map((step) => step.state)

describe('reduceRunEvent', () => {
  it('lists every step as pending when the run starts', () => {
    const view = reduce([started()])
    expect(view.status).toBe('running')
    expect(view.steps.map((step) => step.labelKey)).toEqual([
      'install.steps.device',
      'install.steps.download',
      'install.steps.team'
    ])
    expect(states(view)).toEqual(['pending', 'pending', 'pending'])
  })

  it('follows a step through progress with bytes, a retry and completion', () => {
    const view = reduce([
      started(),
      {
        type: 'step-started',
        stepId: 'device',
        labelKey: 'x',
        index: 0,
        total: 3
      },
      { type: 'step-completed', stepId: 'device' },
      { type: 'progress', fraction: 0.2 },
      {
        type: 'step-started',
        stepId: 'download-0',
        labelKey: 'x',
        index: 1,
        total: 3
      },
      {
        type: 'step-progress',
        stepId: 'download-0',
        fraction: 0.5,
        detail: { received: 14, total: 28 }
      },
      { type: 'progress', fraction: 0.45 }
    ])
    expect(states(view)).toEqual(['done', 'active', 'pending'])
    expect(view.steps[1]).toMatchObject({
      fraction: 0.5,
      detail: { kind: 'bytes', received: 14, total: 28 }
    })
    expect(view.fraction).toBeCloseTo(0.45)
    expect(overallPercent(view)).toBe(45)

    const retrying = reduceRunEvent(view, {
      type: 'step-retrying',
      stepId: 'download-0',
      attempt: 1,
      delayMs: 2000,
      code: ErrorCode.Offline
    })
    expect(retrying.steps[1]).toMatchObject({
      fraction: 0,
      detail: { kind: 'retrying', attempt: 1, delayMs: 2000 }
    })

    const done = reduceRunEvent(view, {
      type: 'step-completed',
      stepId: 'download-0'
    })
    expect(done.steps[1]).toMatchObject({ state: 'done', fraction: 1 })
    expect(done.steps[1]?.detail).toMatchObject({ kind: 'bytes' })
  })

  it('waits on a prompt, and runs again once it is answered', () => {
    const request = { kind: 'apple.choose_team', data: { teams: [] } }
    const waiting = reduce([
      started(),
      {
        type: 'step-started',
        stepId: 'team',
        labelKey: 'x',
        index: 2,
        total: 3
      },
      { type: 'prompt', request }
    ])
    expect(waiting.status).toBe('waiting')
    expect(waiting.prompt).toEqual(request)
    expect(waiting.promptCount).toBe(1)
    expect(states(waiting)[2]).toBe('waiting')

    const answered = answeredView(waiting)
    expect(answered.status).toBe('running')
    expect(answered.prompt).toBeUndefined()
    expect(states(answered)[2]).toBe('active')
  })

  it('marks skipped steps and keeps how finished steps ended when a run resumes', () => {
    const first = reduce([
      started(),
      { type: 'step-skipped', stepId: 'device' },
      {
        type: 'step-progress',
        stepId: 'download-0',
        fraction: 1,
        detail: { received: 28 }
      },
      { type: 'step-completed', stepId: 'download-0' }
    ])
    const resumed = reduce(
      [started(['device', 'download-0'], 0.7)],
      startingView(first)
    )
    expect(states(resumed)).toEqual(['skipped', 'done', 'pending'])
    expect(resumed.steps[1]?.detail).toEqual({
      kind: 'bytes',
      received: 28,
      total: undefined
    })
    expect(resumed.fraction).toBeCloseTo(0.7)
  })
})

describe('finishedView', () => {
  const running = reduce([
    started(),
    {
      type: 'step-started',
      stepId: 'device',
      labelKey: 'x',
      index: 0,
      total: 3
    }
  ])

  it('completes', () => {
    const view = finishedView(running, { status: 'completed', state: {} })
    expect(view.status).toBe('completed')
    expect(view.fraction).toBe(1)
  })

  it('fails at a step, keeping the error and the checkpoint', () => {
    const error = new LoadstarError(ErrorCode.DeviceLocked)
    const view = finishedView(running, {
      status: 'failed',
      error,
      failedStep: 'device',
      checkpoint: CHECKPOINT
    })
    expect(view.status).toBe('failed')
    expect(view.failure).toEqual({ error, stepId: 'device' })
    expect(view.checkpoint).toEqual(CHECKPOINT)
    expect(states(view)[0]).toBe('failed')
  })

  it('treats a cancel and a declined question alike: stopped, resumable', () => {
    const cancelled = finishedView(running, {
      status: 'cancelled',
      checkpoint: CHECKPOINT
    })
    const declined = finishedView(running, {
      status: 'failed',
      error: new LoadstarError(ErrorCode.PromptCancelled),
      failedStep: 'device',
      checkpoint: CHECKPOINT
    })
    for (const view of [cancelled, declined]) {
      expect(view.status).toBe('cancelled')
      expect(view.checkpoint).toEqual(CHECKPOINT)
      expect(states(view)[0]).toBe('pending')
    }
  })

  it('fails where it was, without a checkpoint, when the channel breaks', () => {
    const view = brokenView(
      running,
      new LoadstarError(ErrorCode.RpcDisconnected)
    )
    expect(view.failure?.stepId).toBe('device')
    expect(view.checkpoint).toBeUndefined()
  })
})
