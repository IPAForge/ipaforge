import { describe, expect, it, vi } from 'vitest'

import { createRemoteServerList } from '@apple/application/anisette/server-list.ts'
import { resolveAppleDeps } from '@apple/deps.ts'
import type { AnisetteServer } from '@apple/domain/types.ts'
import type { HttpClient, SecretStore } from '@ipaforge/kernel'

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

const ONE: AnisetteServer = { name: 'One', address: 'https://one.example' }
const TWO: AnisetteServer = { name: 'Two', address: 'https://two.example' }

const memorySecrets = (): SecretStore => {
  const values = new Map<string, Uint8Array>()

  return {
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value)
    },
    delete: async (key) => {
      values.delete(key)
    }
  }
}

const listResponse = (servers: readonly AnisetteServer[]) => ({
  status: 200,
  headers: {},
  body: new Response(JSON.stringify({ servers })).body as ReadableStream<
    Uint8Array<ArrayBuffer>
  >
})

/** A server list endpoint whose answer the test changes; `undefined` = unreachable. */
const setup = (secrets: SecretStore = memorySecrets()) => {
  let answer: readonly AnisetteServer[] | undefined = [ONE]
  let now = 0
  const request = vi.fn(async () => {
    if (!answer) throw new Error('unreachable')
    return listResponse(answer)
  })
  const deps = resolveAppleDeps({
    http: { request } as unknown as HttpClient,
    webSocket: undefined as never,
    secrets,
    clock: { now: () => new Date(now) },
    sleep: async () => {},
    config: { retryAttempts: 1 }
  })

  return {
    list: createRemoteServerList(deps),
    request,
    secrets,
    answer: (servers: readonly AnisetteServer[] | undefined) => {
      answer = servers
    },
    advance: (ms: number) => {
      now += ms
    }
  }
}

describe('remote anisette server list', () => {
  it('is fetched once and reused while fresh', async () => {
    const remote = setup()
    expect(await remote.list.current()).toEqual([ONE])
    remote.advance(HOUR - 1)
    expect(await remote.list.current()).toEqual([ONE])
    expect(remote.request).toHaveBeenCalledTimes(1)
  })

  it('shares one fetch between concurrent requests', async () => {
    const remote = setup()
    await Promise.all([remote.list.current(), remote.list.current()])
    expect(remote.request).toHaveBeenCalledTimes(1)
  })

  it('is fetched again once older than its maximum age', async () => {
    const remote = setup()
    await remote.list.current()
    remote.answer([TWO])
    remote.advance(HOUR)
    expect(await remote.list.current()).toEqual([TWO])
  })

  it('keeps the last known list when a fetch fails, and tries again after the retry delay', async () => {
    const remote = setup()
    await remote.list.current()
    remote.answer(undefined)
    remote.advance(HOUR)
    expect(await remote.list.current()).toEqual([ONE])
    const calls = remote.request.mock.calls.length

    remote.answer([TWO])
    remote.advance(MINUTE - 1)
    expect(await remote.list.current()).toEqual([ONE])
    expect(remote.request).toHaveBeenCalledTimes(calls)
    remote.advance(1)
    expect(await remote.list.current()).toEqual([TWO])
  })

  it('starts from the saved list when the first fetch fails', async () => {
    const first = setup()
    await first.list.current()

    const restarted = setup(first.secrets)
    restarted.answer(undefined)
    restarted.advance(HOUR)
    expect(await restarted.list.current()).toEqual([ONE])
  })

  it('does not fetch at start while the saved list is fresh', async () => {
    const first = setup()
    await first.list.current()

    const restarted = setup(first.secrets)
    expect(await restarted.list.current()).toEqual([ONE])
    expect(restarted.request).not.toHaveBeenCalled()
  })

  it('is empty when nothing was ever fetched', async () => {
    const remote = setup()
    remote.answer(undefined)
    expect(await remote.list.current()).toEqual([])
  })
})
