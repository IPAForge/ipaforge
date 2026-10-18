// The RPC Transport over an Electron main-process MessagePort (`MessagePortMain`). The port is described here
// structurally, so this compiles and is tested without the electron package; Electron's own type fits it.

import type {
  MainMessagePort,
  MessageListener
} from '@desktop/main/rpc/types.ts'
import type { Transport } from '@ipaforge/rpc'

export const messagePortTransport = (port: MainMessagePort): Transport => {
  port.start()
  return {
    send: (message) => port.postMessage(message),
    onMessage: (listener) => {
      const onMessage: MessageListener = (event) => listener(event.data)
      port.on('message', onMessage)
      return () => port.off('message', onMessage)
    },
    onClose: (listener) => {
      port.on('close', listener)
      return () => port.off('close', listener)
    },
    close: () => port.close()
  }
}
