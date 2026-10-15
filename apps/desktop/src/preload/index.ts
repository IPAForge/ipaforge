// Preload: the only bridge between the sandboxed renderer and the main process.
// It exposes nothing yet. Once the Engine is wired (Phase 6c / 9) it will hand the renderer the rpc MessagePort
// and nothing else: no ipcRenderer, no Node APIs.
import { contextBridge } from 'electron'

/** Read-only facts about the shell, for diagnostics. */
const shell = Object.freeze({
  platform: process.platform,
  versions: Object.freeze({
    electron: process.versions.electron,
    chrome: process.versions.chrome
  })
})

contextBridge.exposeInMainWorld('loadstarShell', shell)
