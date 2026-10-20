// Preload: the only bridge between the sandboxed renderer and the main process. It forwards the rpc and update
// MessagePorts to the page and exposes one function, the path of a file the user dropped (for the Preload page); no ipcRenderer,
// no Node.
import { contextBridge, ipcRenderer, webUtils } from 'electron'

import { exposeFilePaths } from '@desktop/preload/expose-file-paths.ts'
import { forwardPorts } from '@desktop/preload/forward-port.ts'
import type { FilePathBridge, PortTarget } from '@desktop/preload/types.ts'
import { RPC_PORT_CHANNEL } from '@desktop/shared/rpc-channel.ts'
import { UPDATES_PORT_CHANNEL } from '@desktop/shared/updates-channel.ts'

// The preload's global is the page's window (its isolated world); the desktop tsconfig has no DOM types.
forwardPorts(ipcRenderer, globalThis as unknown as PortTarget, [
  RPC_PORT_CHANNEL,
  UPDATES_PORT_CHANNEL
])
exposeFilePaths({
  contextBridge,
  webUtils: webUtils as FilePathBridge['webUtils']
})
