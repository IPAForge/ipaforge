import { join } from 'node:path'

import { app, BrowserWindow, type WebContents } from 'electron'

import type { Logger } from '@loadstar/kernel'

const WINDOW_WIDTH = 1200
const WINDOW_HEIGHT = 800
const WINDOW_MIN_WIDTH = 900
const WINDOW_MIN_HEIGHT = 600
const WINDOW_TITLE = 'Loadstar'

/** Built by electron-vite next to `out/main`: the CommonJS preload and the renderer's index.html. */
const PRELOAD_PATH = join(import.meta.dirname, '../preload/index.cjs')
const RENDERER_HTML_PATH = join(import.meta.dirname, '../renderer/index.html')
/** Set by `electron-vite dev` to the renderer's dev server; ignored in a packaged app. */
const DEV_SERVER_URL_ENV = 'ELECTRON_RENDERER_URL'

const loadRenderer = (window: BrowserWindow, logger: Logger): Promise<void> => {
  const devServerUrl = app.isPackaged
    ? undefined
    : process.env[DEV_SERVER_URL_ENV]
  logger.info('loading the renderer', { from: devServerUrl ?? 'build' })
  return devServerUrl
    ? window.loadURL(devServerUrl)
    : window.loadFile(RENDERER_HTML_PATH)
}

/**
 * The one app window: an isolated, sandboxed renderer without Node, shown once its first frame is ready.
 * `connect` runs before the page loads, to serve the Engine to it.
 */
export const createMainWindow = async (
  logger: Logger,
  connect: (contents: WebContents) => void
): Promise<BrowserWindow> => {
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    title: WINDOW_TITLE,
    show: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })
  window.once('ready-to-show', () => window.show())
  window.webContents.on('render-process-gone', (_event, details) => {
    logger.error('the renderer process is gone', {
      reason: details.reason,
      exitCode: details.exitCode
    })
  })
  connect(window.webContents)
  await loadRenderer(window, logger)
  return window
}
