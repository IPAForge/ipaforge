import { describe, expect, it } from 'vitest'

import { liveProgress } from '@ui/features/install/run/utils/live-progress.ts'

const MB = 1024 * 1024

describe('liveProgress', () => {
  it('gives the percent, the speed and the time left of a transfer', () => {
    expect(
      liveProgress({
        kind: 'bytes',
        received: 30 * MB,
        total: 120 * MB,
        elapsedMs: 10_000
      })
    ).toEqual({
      percent: 25,
      bytes: { received: 30 * MB, total: 120 * MB },
      bytesPerSecond: 3 * MB,
      secondsLeft: 30
    })
  })

  it('leaves out the speed until some time has passed', () => {
    expect(
      liveProgress({ kind: 'bytes', received: 0, total: 10, elapsedMs: 0 })
    ).toEqual({
      percent: 0,
      bytes: { received: 0, total: 10 }
    })
  })

  it("names iOS's install phase and estimates the time left from its pace", () => {
    expect(
      liveProgress({
        kind: 'installing',
        percent: 40,
        status: 'VerifyingApplication',
        elapsedMs: 20_000
      })
    ).toEqual({ percent: 40, phase: 'checking', secondsLeft: 30 })
    expect(
      liveProgress({ kind: 'installing', percent: 5, status: 'SomethingNew' })
        ?.phase
    ).toBe('installing')
  })

  it('has nothing to say about a transfer without a total, or a retry', () => {
    expect(liveProgress({ kind: 'bytes', received: 5 })).toBeUndefined()
    expect(
      liveProgress({ kind: 'retrying', attempt: 1, delayMs: 1000 })
    ).toBeUndefined()
    expect(liveProgress(undefined)).toBeUndefined()
  })

  it('says which provisioning task runs, how many of its requests are done, and the time left', () => {
    expect(
      liveProgress({
        kind: 'provisioning',
        task: 'profiles',
        done: 2,
        total: 5,
        fraction: 0.5,
        elapsedMs: 4000
      })
    ).toEqual({
      percent: 50,
      task: { name: 'profiles', done: 2, total: 5 },
      secondsLeft: 4
    })
  })
})
