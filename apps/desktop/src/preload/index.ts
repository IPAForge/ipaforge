// Preload: the only bridge between the sandboxed renderer and the main process. It forwards the rpc MessagePort to
// the page and exposes one function, the path of a file the user dropped (for the Preload page); no ipcRenderer,
// no Node.
import { contextBridge, ipcRenderer, webUtils } from 'electron'

import { exposeFilePaths } from '@desktop/preload/expose-file-paths.ts'
import { forwardRpcPort } from '@desktop/preload/forward-port.ts'
import type { FilePathBridge, PortTarget } from '@desktop/preload/types.ts'

// The preload's global is the page's window (its isolated world); the desktop tsconfig has no DOM types.
forwardRpcPort(ipcRenderer, globalThis as unknown as PortTarget)
exposeFilePaths({
  contextBridge,
  webUtils: webUtils as FilePathBridge['webUtils']
})
