// The renderer's end of the rpc channel: waits for the MessagePort the preload forwards, and wraps it in a
// Transport for `createEngineClient`.
import { RPC_PORT_CHANNEL } from '@desktop/shared/rpc-channel.ts'
import type { Transport } from '@loadstar/rpc'

/** The part of `window` this uses. */
export type PortSource = {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent) => void
  ): void
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent) => void
  ): void
}

/** Resolves with the rpc port once the preload posts it; only a message from this window itself counts. */
export const receiveEnginePort = (source: PortSource): Promise<MessagePort> =>
  new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const [port] = event.ports
      if (event.source !== source || event.data !== RPC_PORT_CHANNEL || !port)
        return
      source.removeEventListener('message', onMessage)
      resolve(port)
    }
    source.addEventListener('message', onMessage)
  })

export const messagePortTransport = (port: MessagePort): Transport => {
  port.start()
  return {
    send: (message) => port.postMessage(message),
    onMessage: (listener) => {
      const onMessage = (event: MessageEvent) => listener(event.data)
      port.addEventListener('message', onMessage)
      return () => port.removeEventListener('message', onMessage)
    },
    onClose: (listener) => {
      port.addEventListener('close', listener)
      return () => port.removeEventListener('close', listener)
    },
    close: () => port.close()
  }
}
