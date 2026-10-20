import { EventEmitter } from 'node:events'

import { describe, expect, it, vi } from 'vitest'

import { portPair } from '@desktop/main/rpc/__tests__/port-pair.ts'
import { messagePortTransport } from '@desktop/main/rpc/message-port-transport.ts'
import type {
  MainMessagePort,
  RendererContents
} from '@desktop/main/rpc/types.ts'
import { serveUpdateState } from '@desktop/main/updates/serve-updates.ts'
import { UPDATES_PORT_CHANNEL } from '@desktop/shared/updates-channel.ts'
import {
  createUpdateClient,
  type UpdateSource,
  type UpdateState
} from '@ipaforge/rpc'

const INSTALLING: UpdateState = {
  phase: 'installing',
  version: '0.1.0-alpha.99'
}

const serve = () => {
  const events = new EventEmitter()
  const posted: { channel: string; ports: MainMessagePort[] }[] = []
  const contents: RendererContents<MainMessagePort> = {
    postMessage: (channel, _message, transfer) => {
      posted.push({ channel, ports: transfer })
    },
    on: (event, listener) => events.on(event, listener)
  }
  const listeners = new Set<(state: UpdateState) => void>()
  const source: UpdateSource = {
    current: () => INSTALLING,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    retry: vi.fn()
  }
  serveUpdateState(contents, source, () => {
    const [port1, port2] = portPair()

    return { port1, port2 }
  })
  const clientOn = (index: number) => {
    const port = posted[index]?.ports[0]
    if (!port) throw new Error(`no port posted for load ${index}`)
    return createUpdateClient(messagePortTransport(port))
  }

  return { events, posted, clientOn, listeners }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('serveUpdateState', () => {
  it('posts a fresh channel on every page load, with the state on it', async () => {
    const { events, posted, clientOn, listeners } = serve()
    events.emit('did-finish-load')
    const client = clientOn(0)
    await flush()

    expect(posted.map((post) => post.channel)).toEqual([UPDATES_PORT_CHANNEL])
    expect(client.current()).toEqual(INSTALLING)

    events.emit('did-finish-load')
    expect(posted).toHaveLength(2)
    expect(listeners.size).toBe(1)
  })

  it('stops when the window goes away', () => {
    const { events, listeners } = serve()
    events.emit('did-finish-load')
    events.emit('destroyed')

    expect(listeners.size).toBe(0)
  })
})
