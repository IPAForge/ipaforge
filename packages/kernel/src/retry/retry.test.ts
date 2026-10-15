import { describe, expect, it } from 'vitest'

import {
  backoffDelay,
  isTransientHttpStatus,
  retry
} from '@kernel/retry/retry.ts'

describe('retry', () => {
  it('retries only what retryOn allows, with growing delays', async () => {
    const delays: number[] = []
    let calls = 0
    const result = await retry(
      async () => {
        calls++
        if (calls < 3) throw new Error('busy')
        return 'ok'
      },
      {
        retryOn: () => true,
        sleep: async (ms) => void delays.push(ms),
        random: () => 1,
        baseMs: 100
      }
    )
    expect(result).toBe('ok')
    expect(delays).toEqual([100, 200])
  })

  it('gives up after the last attempt and never retries by default', async () => {
    let calls = 0
    const fail = async () => {
      calls++
      throw new Error('no')
    }
    await expect(
      retry(fail, { attempts: 3, retryOn: () => true, sleep: async () => {} })
    ).rejects.toThrow('no')
    expect(calls).toBe(3)
    calls = 0
    await expect(retry(fail, { sleep: async () => {} })).rejects.toThrow('no')
    expect(calls).toBe(1)
  })

  it('caps and jitters delays', () => {
    expect(backoffDelay(10, { baseMs: 500, maxMs: 2000, jitter: 0 })).toBe(2000)
    expect(backoffDelay(1, { baseMs: 1000, jitter: 0.5 }, () => 0)).toBe(500)
  })

  it('knows which HTTP statuses are transient', () => {
    expect([429, 502, 503, 504].every(isTransientHttpStatus)).toBe(true)
    expect([400, 401, 403, 404, 500].some(isTransientHttpStatus)).toBe(false)
  })
})
