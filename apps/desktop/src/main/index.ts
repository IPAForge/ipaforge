// Electron main process: the app lifecycle, the hardening and the one window.
//
// Engine wiring lands here later (Phase 6c / 9): build the Engine with `createDesktopEngine`
// (@desktop/main/engine.ts), then for each window open a MessageChannelMain, hand one port to the preload and
// serve the Engine on the other with `createRpcServer` over `messagePortTransport` (@desktop/main/rpc/).

import { app, BrowserWindow, session } from 'electron'

import { createMainLogger } from '@desktop/main/logger.ts'
import {
  denyAllPermissions,
  lockDownWebContents
} from '@desktop/main/security.ts'
import { createMainWindow } from '@desktop/main/window.ts'
import type { Logger } from '@loadstar/kernel'

const openWindow = (logger: Logger): void => {
  createMainWindow(logger).catch((error: unknown) =>
    logger.error('could not open the window', { error })
  )
}

const start = (logger: Logger): void => {
  app.on('web-contents-created', (_event, contents) =>
    lockDownWebContents(contents, logger)
  )
  // macOS keeps the app running without windows; every other OS quits with the last one.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow(logger)
  })
  app
    .whenReady()
    .then(() => {
      denyAllPermissions(session.defaultSession, logger)
      logger.info('ready', {
        electron: process.versions.electron,
        platform: process.platform
      })
      openWindow(logger)
    })
    .catch((error: unknown) => logger.error('could not start', { error }))
}

start(createMainLogger())
