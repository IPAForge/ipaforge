// Electron main process: the app lifecycle, the hardening, the Engine and the one window.
//
// The Engine is built once, with the Node adapters (`createDesktopEngine`). Each page load of the window gets a
// fresh MessageChannelMain: the rpc server on one end, the other end posted to the page (`serveEngine`).
// The renderer never gets file paths of its own: importing IPAs (Phase 9) opens a file dialog here, in main.

import { join } from 'node:path'

import {
  app,
  BrowserWindow,
  MessageChannelMain,
  safeStorage,
  session,
  type WebContents
} from 'electron'

import { createFileDownloadStore } from '@desktop/main/adapters/file-download-store.ts'
import { createNodeHttpClient } from '@desktop/main/adapters/http-client.ts'
import { createDesktopEngine } from '@desktop/main/engine.ts'
import { createMainLogger } from '@desktop/main/logger.ts'
import { createIpaResolver } from '@desktop/main/rpc/resolve-ipa.ts'
import { serveEngine } from '@desktop/main/rpc/serve-engine.ts'
import { createDesktopSecrets } from '@desktop/main/secrets.ts'
import {
  denyAllPermissions,
  lockDownWebContents
} from '@desktop/main/security.ts'
import { createMainWindow } from '@desktop/main/window.ts'
import type { Logger } from '@loadstar/kernel'

/** Wires the Engine (needs the app to be ready: safeStorage) and returns how a window connects to it. */
const createEngineConnector = (logger: Logger) => {
  const dataDir = app.getPath('userData')
  const secrets = createDesktopSecrets({
    dataDir,
    safeStorage,
    platform: process.platform,
    logger
  })
  const engine = createDesktopEngine({ secrets, dataDir, logger })
  const resolveIpa = createIpaResolver({
    http: createNodeHttpClient(),
    store: createFileDownloadStore(join(dataDir, 'downloads'))
  })

  return (contents: WebContents) =>
    serveEngine(contents, {
      engine,
      resolveIpa,
      logger,
      createChannel: () => new MessageChannelMain()
    })
}

const openWindow = (
  logger: Logger,
  connect: (contents: WebContents) => void
): void => {
  createMainWindow(logger, connect).catch((error: unknown) =>
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
  app
    .whenReady()
    .then(() => {
      denyAllPermissions(session.defaultSession, logger)
      logger.info('ready', {
        electron: process.versions.electron,
        platform: process.platform
      })
      const connect = createEngineConnector(logger)
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
          openWindow(logger, connect)
      })
      openWindow(logger, connect)
    })
    .catch((error: unknown) => logger.error('could not start', { error }))
}

start(createMainLogger())
