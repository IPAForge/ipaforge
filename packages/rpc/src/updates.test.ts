import { describe, expect, it, vi } from 'vitest'

import { createUpdateClient, serveUpdates } from '@rpc/application/updates.ts'
import type { UpdateSource } from '@rpc/domain/ports/update-source.ts'
import type { UpdateState } from '@rpc/domain/protocol/types.ts'
import { createMemoryTransportPair } from '@rpc/infrastructure/memory-transport.ts'

const DOWNLOADING: UpdateState = {
  phase: 'downloading',
  version: '0.1.0-alpha.4',
  transferred: 10,
  total: 100,
  bytesPerSecond: 5
}

/** A host updater the test moves from state to state. */
const hostSource = (initial: UpdateState) => {
  const listeners = new Set<(state: UpdateState) => void>()
  let state = initial
  const retry = vi.fn()
  const source: UpdateSource = {
    current: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    retry
  }
  const set = (next: UpdateState) => {
    state = next
    for (const listener of listeners) listener(next)
  }

  return { source, set, retry, listeners }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('the update channel', () => {
  it('gives the UI the host state now and on every change', async () => {
    const [hostEnd, uiEnd] = createMemoryTransportPair()
    const client = createUpdateClient(uiEnd)
    const host = hostSource({ phase: 'checking' })
    serveUpdates(host.source, hostEnd)
    const seen: UpdateState[] = []
    client.subscribe((state) => seen.push(state))

    host.set(DOWNLOADING)
    await flush()

    expect(client.current()).toEqual(DOWNLOADING)
    expect(seen.at(-1)).toEqual(DOWNLOADING)
  })

  it('passes Try again to the host', async () => {
    const [hostEnd, uiEnd] = createMemoryTransportPair()
    const client = createUpdateClient(uiEnd)
    const host = hostSource({ phase: 'idle' })
    serveUpdates(host.source, hostEnd)

    client.retry()
    await flush()

    expect(host.retry).toHaveBeenCalledOnce()
  })

  it('drops messages that are not an update state', async () => {
    const [hostEnd, uiEnd] = createMemoryTransportPair()
    const client = createUpdateClient(uiEnd)

    hostEnd.send({
      phase: 'failed',
      version: '1',
      reason: 'x',
      url: 'not a link'
    })
    hostEnd.send('nonsense')
    await flush()

    expect(client.current()).toEqual({ phase: 'checking' })
  })

  it('stops following the host once the channel closes', async () => {
    const [hostEnd] = createMemoryTransportPair()
    const host = hostSource({ phase: 'idle' })
    serveUpdates(host.source, hostEnd)

    hostEnd.close()
    await flush()

    expect(host.listeners.size).toBe(0)
  })
})
