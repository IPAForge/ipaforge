import { EventEmitter } from 'node:events'

import type { MainMessagePort } from '@desktop/main/rpc/types.ts'

/** Two linked ports that behave like Electron's: `{ data }` events, delivered asynchronously, `close` on both. */
export const portPair = (): [MainMessagePort, MainMessagePort] => {
  const emitters = [new EventEmitter(), new EventEmitter()] as const
  let closed = false
  const port = (own: EventEmitter, peer: EventEmitter): MainMessagePort =>
    Object.assign(own, {
      postMessage: (message: unknown) => {
        if (closed) return
        setImmediate(() =>
          peer.emit('message', { data: structuredClone(message) })
        )
      },
      start: () => {},
      close: () => {
        closed = true
        setImmediate(() => {
          for (const emitter of emitters) emitter.emit('close')
        })
      }
    })

  return [port(emitters[0], emitters[1]), port(emitters[1], emitters[0])]
}
