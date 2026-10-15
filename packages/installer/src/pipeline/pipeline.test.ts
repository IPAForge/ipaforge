import { describe, expect, it } from 'vitest'

import type { PipelineEvent } from '@installer/pipeline/events.ts'
import { pipeline } from '@installer/pipeline/pipeline.ts'
import type { Step } from '@installer/pipeline/step.ts'
import { ErrorCode, LoadstarError } from '@loadstar/kernel'

type State = {
  readonly log: readonly string[]
  readonly downloaded?: boolean
  readonly team?: string
}

const instant = async () => {}

const record =
  (name: string): Step<State>['run'] =>
  async (state) => ({ log: [...state.log, name] })

describe('pipeline', () => {
  it('runs steps in order, merges state and reports weighted progress', async () => {
    const events: PipelineEvent[] = []
    const flow = pipeline<State>('demo', [
      { id: 'a', labelKey: 'a', weight: 1, run: record('a') },
      {
        id: 'b',
        labelKey: 'b',
        weight: 3,
        run: async (state, context) => {
          context.progress(0.5)
          return { log: [...state.log, 'b'], downloaded: true }
        }
      }
    ])
    const result = await flow.run(
      { log: [] },
      { onEvent: (event) => events.push(event) }
    )
    expect(result).toEqual({
      status: 'completed',
      state: { log: ['a', 'b'], downloaded: true }
    })
    const fractions = events
      .filter((e) => e.type === 'progress')
      .map((e) => (e as { fraction: number }).fraction)
    expect(fractions).toEqual([0.25, 0.625, 1])
  })

  it('skips steps whose condition holds', async () => {
    const flow = pipeline<State>('demo', [
      {
        id: 'download',
        labelKey: 'd',
        skip: (s) => s.downloaded === true,
        run: record('download')
      },
      { id: 'install', labelKey: 'i', run: record('install') }
    ])
    const result = await flow.run({ log: [], downloaded: true })
    expect(result.status === 'completed' && result.state.log).toEqual([
      'install'
    ])
  })

  it('retries idempotent steps on transient errors only', async () => {
    let calls = 0
    const flaky: Step<State> = {
      id: 'download',
      labelKey: 'd',
      idempotent: true,
      run: async (state) => {
        calls++
        if (calls < 3) throw new LoadstarError(ErrorCode.Offline)
        return { log: [...state.log, 'download'] }
      }
    }
    const events: PipelineEvent[] = []
    const result = await pipeline<State>('demo', [flaky]).run(
      { log: [] },
      { sleep: instant, onEvent: (e) => events.push(e) }
    )
    expect(result.status).toBe('completed')
    expect(events.filter((e) => e.type === 'step-retrying')).toHaveLength(2)

    let writes = 0
    const nonIdempotent: Step<State> = {
      id: 'create-app-id',
      labelKey: 'c',
      run: async () => {
        writes++
        throw new LoadstarError(ErrorCode.Offline)
      }
    }
    const failed = await pipeline<State>('demo', [nonIdempotent]).run(
      { log: [] },
      { sleep: instant }
    )
    expect(failed.status).toBe('failed')
    expect(writes).toBe(1)
  })

  it('reports failures with the step and a checkpoint to resume from', async () => {
    let fail = true
    const flow = pipeline<State>('install', [
      { id: 'sign', labelKey: 's', run: record('sign') },
      {
        id: 'upload',
        labelKey: 'u',
        run: async (state) => {
          if (fail) throw new LoadstarError(ErrorCode.DeviceLocked)
          return { log: [...state.log, 'upload'] }
        }
      },
      { id: 'done', labelKey: 'x', run: record('done') }
    ])
    const first = await flow.run({ log: [] })
    expect(first.status).toBe('failed')
    if (first.status !== 'failed') return
    expect(first.failedStep).toBe('upload')
    expect(first.error.code).toBe(ErrorCode.DeviceLocked)
    fail = false
    const resumed = await flow.run({ log: [] }, { resume: first.checkpoint })
    expect(resumed.status === 'completed' && resumed.state.log).toEqual([
      'sign',
      'upload',
      'done'
    ])
  })

  it('wraps unexpected errors and refuses a checkpoint from another pipeline', async () => {
    const flow = pipeline<State>('x', [
      {
        id: 'boom',
        labelKey: 'b',
        run: async () => {
          throw new TypeError('bug')
        }
      }
    ])
    const result = await flow.run({ log: [] })
    expect(result.status === 'failed' && result.error.code).toBe(
      ErrorCode.StepFailed
    )
    await expect(
      flow.run(
        { log: [] },
        { resume: { pipelineId: 'y', completed: [], state: { log: [] } } }
      )
    ).rejects.toThrow()
  })

  it('asks the user through prompts and cancels between steps', async () => {
    const flow = pipeline<State>('signin', [
      {
        id: 'team',
        labelKey: 't',
        run: async (_state, context) => ({
          team: await context.prompt<string>({
            kind: 'choose-team',
            data: { teams: 2 }
          })
        })
      },
      { id: 'after', labelKey: 'a', run: record('after') }
    ])
    const answered = await flow.run(
      { log: [] },
      {
        onPrompt: async (request) =>
          request.kind === 'choose-team' ? 'TEAM1' : ''
      }
    )
    expect(answered.status === 'completed' && answered.state.team).toBe('TEAM1')

    const controller = new AbortController()
    const cancelled = await flow.run(
      { log: [] },
      {
        signal: controller.signal,
        onPrompt: async () => {
          controller.abort()
          return 'TEAM1'
        }
      }
    )
    expect(cancelled.status).toBe('cancelled')
    if (cancelled.status === 'cancelled')
      expect(cancelled.checkpoint.completed).toEqual(['team'])

    const noHandler = await flow.run({ log: [] })
    expect(noHandler.status === 'failed' && noHandler.error.code).toBe(
      ErrorCode.PromptCancelled
    )
  })

  it('rejects duplicate step ids', () => {
    expect(() =>
      pipeline<State>('dup', [
        { id: 'a', labelKey: 'a', run: record('a') },
        { id: 'a', labelKey: 'a', run: record('a') }
      ])
    ).toThrow()
  })
})
