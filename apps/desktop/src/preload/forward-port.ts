// Hands the page the rpc MessagePort the main process sends, and nothing else: no ipcRenderer, no Node API and no
// contextBridge object reach the page, only the port, as a transferred MessagePort on a window message.

import type { PortReceiver, PortTarget } from '@desktop/preload/types.ts'
import { RPC_PORT_CHANNEL } from '@desktop/shared/rpc-channel.ts'

export const forwardRpcPort = (ipc: PortReceiver, page: PortTarget): void => {
  ipc.on(RPC_PORT_CHANNEL, ({ ports }) =>
    // A file:// page has the opaque origin "null", which only "*" matches; the page checks the message's source.
    page.postMessage(RPC_PORT_CHANNEL, '*', [...ports])
  )
}
