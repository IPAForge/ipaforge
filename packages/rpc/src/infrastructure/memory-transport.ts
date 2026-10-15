// Two linked in-memory transports, for tests and for running the UI without Electron. Like a MessagePort, delivery
// is asynchronous and every message is structured-cloned, so whatever works here also crosses a real channel.
import { disconnected } from '@rpc/domain/errors.ts'
import type { Transport } from '@rpc/domain/ports/transport.ts'

type End = {
  readonly messageListeners: Set<(message: unknown) => void>
  readonly closeListeners: Set<() => void>
}

const createEnd = (): End => ({
  messageListeners: new Set(),
  closeListeners: new Set()
})

const subscribe = <L>(listeners: Set<L>, listener: L): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const createMemoryTransportPair = (): readonly [
  Transport,
  Transport
] => {
  const ends = [createEnd(), createEnd()] as const
  let closed = false

  const close = (): void => {
    if (closed) return
    closed = true
    // Queued after any message already sent, so those still arrive first.
    queueMicrotask(() => {
      for (const end of ends)
        for (const listener of [...end.closeListeners]) listener()
    })
  }

  const transport = (own: End, peer: End): Transport => ({
    send: (message) => {
      if (closed) throw disconnected()
      const copy = structuredClone(message)
      queueMicrotask(() => {
        for (const listener of [...peer.messageListeners]) listener(copy)
      })
    },
    onMessage: (listener) => subscribe(own.messageListeners, listener),
    onClose: (listener) => subscribe(own.closeListeners, listener),
    close
  })

  return [transport(ends[0], ends[1]), transport(ends[1], ends[0])]
}
