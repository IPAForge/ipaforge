import { describe, expect, it } from 'vitest'

import {
  messagePortTransport,
  type PortSource,
  receiveEnginePort
} from '@desktop/renderer/engine-port.ts'
import { RPC_PORT_CHANNEL } from '@desktop/shared/rpc-channel.ts'

/** A window: an event target whose own messages carry it as their `source`. */
const fakeWindow = () => {
  // An EventTarget delivers any Event; the page only ever gets MessageEvents on `message`.
  const target = new EventTarget() as unknown as PortSource
  const post = (data: unknown, ports: MessagePort[], source: unknown) => {
    const event = new Event('message') as MessageEvent
    Object.defineProperties(event, {
      data: { value: data },
      ports: { value: ports },
      source: { value: source }
    })
    ;(target as unknown as EventTarget).dispatchEvent(event)
  }

  return { target, post }
}

describe('receiveEnginePort', () => {
  it('takes the port only from its own window, on the rpc message', async () => {
    const window = fakeWindow()
    const { port1, port2 } = new MessageChannel()
    const received = receiveEnginePort(window.target)

    window.post('something else', [port2], window.target)
    window.post(RPC_PORT_CHANNEL, [port2], {})
    window.post(RPC_PORT_CHANNEL, [port1], window.target)

    expect(await received).toBe(port1)
    port1.close()
    port2.close()
  })
})

describe('messagePortTransport', () => {
  it('sends and receives over a MessagePort', async () => {
    const { port1, port2 } = new MessageChannel()
    const left = messagePortTransport(port1)
    const right = messagePortTransport(port2)
    const message = new Promise((resolve) => right.onMessage(resolve))

    left.send({ v: 1, hello: 'engine' })
    expect(await message).toEqual({ v: 1, hello: 'engine' })
    left.close()
    right.close()
  })
})
