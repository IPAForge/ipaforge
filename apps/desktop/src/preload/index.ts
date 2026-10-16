// Preload: the only bridge between the sandboxed renderer and the main process. It forwards the rpc MessagePort
// to the page and exposes nothing else (no contextBridge API, no ipcRenderer, no Node).
import { ipcRenderer } from 'electron'

import {
  forwardRpcPort,
  type PortTarget
} from '@desktop/preload/forward-port.ts'

// The preload's global is the page's window (its isolated world); the desktop tsconfig has no DOM types.
forwardRpcPort(ipcRenderer, globalThis as unknown as PortTarget)
