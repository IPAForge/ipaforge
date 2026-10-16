// Hands the page the rpc MessagePort the main process sends, and nothing else: no ipcRenderer, no Node API and no
// contextBridge object reach the page, only the port, as a transferred MessagePort on a window message.
import { RPC_PORT_CHANNEL } from '@desktop/shared/rpc-channel.ts'

/** The part of Electron's `ipcRenderer` this uses. */
export type PortReceiver = {
  on(
    channel: string,
    listener: (event: { readonly ports: readonly MessagePort[] }) => void
  ): unknown
}

/** The part of the page's `window` this uses. */
export type PortTarget = {
  postMessage(
    message: unknown,
    targetOrigin: string,
    transfer: Transferable[]
  ): void
}

export const forwardRpcPort = (ipc: PortReceiver, page: PortTarget): void => {
  ipc.on(RPC_PORT_CHANNEL, ({ ports }) =>
    // A file:// page has the opaque origin "null", which only "*" matches; the page checks the message's source.
    page.postMessage(RPC_PORT_CHANNEL, '*', [...ports])
  )
}
