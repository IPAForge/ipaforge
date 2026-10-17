import { EventEmitter } from 'node:events'

import { describe, expect, it, vi } from 'vitest'

import { portPair } from '@desktop/main/rpc/__tests__/port-pair.ts'
import { messagePortTransport } from '@desktop/main/rpc/message-port-transport.ts'
import { serveEngine } from '@desktop/main/rpc/serve-engine.ts'
import type {
  MainMessagePort,
  RendererContents
} from '@desktop/main/rpc/types.ts'
import { RPC_PORT_CHANNEL } from '@desktop/shared/rpc-channel.ts'
import type { Engine } from '@loadstar/installer'
import { ErrorCode, silentLogger } from '@loadstar/kernel'
import { createEngineClient } from '@loadstar/rpc'

/** A window's web contents: page loads to emit, and the ports it was posted. */
const fakeContents = () => {
  const events = new EventEmitter()
  const posted: { channel: string; ports: MainMessagePort[] }[] = []
  const contents: RendererContents<MainMessagePort> = {
    postMessage: (channel, _message, transfer) => {
      posted.push({ channel, ports: transfer })
    },
    on: (event, listener) => events.on(event, listener)
  }

  return { contents, events, posted }
}

const engine = {
  listDevices: async () => [{ udid: 'UDID1' }]
} as unknown as Engine

const serve = () => {
  const fake = fakeContents()
  serveEngine(fake.contents, {
    engine,
    resolveIpa: vi.fn(),
    logger: silentLogger,
    createChannel: () => {
      const [port1, port2] = portPair()

      return { port1, port2 }
    }
  })
  const clientOn = (index: number) => {
    const port = fake.posted[index]?.ports[0]
    if (!port) throw new Error(`no port posted for load ${index}`)
    return createEngineClient(messagePortTransport(port))
  }

  return { ...fake, clientOn }
}

describe('serveEngine', () => {
  it('posts one end of a fresh channel to the page once it has loaded, and serves the Engine on the other', async () => {
    const { events, posted, clientOn } = serve()
    expect(posted).toEqual([])

    events.emit('did-finish-load')
    expect(posted).toHaveLength(1)
    expect(posted[0]?.channel).toBe(RPC_PORT_CHANNEL)
    expect(await clientOn(0).listDevices()).toEqual([{ udid: 'UDID1' }])
  })

  it('drops the old channel when the page loads again', async () => {
    const { events, posted, clientOn } = serve()
    events.emit('did-finish-load')
    const first = clientOn(0)
    events.emit('did-finish-load')

    expect(posted).toHaveLength(2)
    await expect(first.listDevices()).rejects.toMatchObject({
      code: ErrorCode.RpcDisconnected
    })
    expect(await clientOn(1).listDevices()).toEqual([{ udid: 'UDID1' }])
  })

  it('closes the channel when the window goes away', async () => {
    const { events, clientOn } = serve()
    events.emit('did-finish-load')
    const client = clientOn(0)
    events.emit('destroyed')

    await expect(client.listDevices()).rejects.toMatchObject({
      code: ErrorCode.RpcDisconnected
    })
  })
})
