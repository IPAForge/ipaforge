// Hands the page the MessagePorts the main process sends (the rpc one and the update one), and nothing else: no
// ipcRenderer, no Node API and no contextBridge object reach the page, only the ports, each as a transferred
// MessagePort on a window message named after its channel.

import type { PortReceiver, PortTarget } from '@desktop/preload/types.ts'

export const forwardPorts = (
  ipc: PortReceiver,
  page: PortTarget,
  channels: readonly string[]
): void => {
  for (const channel of channels)
    ipc.on(channel, ({ ports }) =>
      // A file:// page has the opaque origin "null", which only "*" matches; the page checks the message's source.
      page.postMessage(channel, '*', [...ports])
    )
}
