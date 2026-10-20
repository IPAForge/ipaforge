// The update channel, beside the Engine's own: the host serves its updater's state over a transport, and the UI
// keeps the last state it got. Messages the other end can't have sent are dropped.

import type { Transport } from '@rpc/domain/ports/transport.ts'
import type { UpdateSource } from '@rpc/domain/ports/update-source.ts'
import type { UpdateState } from '@rpc/domain/protocol/types.ts'
import {
  UPDATE_RETRY,
  updateRequestSchema,
  updateStateSchema
} from '@rpc/domain/protocol/updates.ts'

/** Sends the state now and on every change, and tries again when the UI asks; stops when the channel closes. */
export const serveUpdates = (
  source: UpdateSource,
  transport: Transport
): (() => void) => {
  const unsubscribe = source.subscribe((state) => transport.send(state))
  const offMessage = transport.onMessage((message) => {
    if (updateRequestSchema.safeParse(message).success) source.retry()
  })
  let offClose = () => {}
  const stop = () => {
    unsubscribe()
    offMessage()
    offClose()
  }
  offClose = transport.onClose(stop)
  transport.send(source.current())

  return stop
}

/** The UI's end: checking until the host's first state arrives. */
export const createUpdateClient = (transport: Transport): UpdateSource => {
  const listeners = new Set<(state: UpdateState) => void>()
  let state: UpdateState = { phase: 'checking' }

  transport.onMessage((message) => {
    const parsed = updateStateSchema.safeParse(message)
    if (!parsed.success) return
    state = parsed.data
    for (const listener of [...listeners]) listener(state)
  })

  return {
    current: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    retry: () => transport.send(UPDATE_RETRY)
  }
}
