// Electron main process: the app lifecycle, the hardening, the Engine, updating on launch and the one window.
//
// The Engine is built once, with the Node adapters (`createDesktopEngine`). Each page load of the window gets a
// fresh MessageChannelMain: the rpc server on one end, the other end posted to the page (`serveEngine`).
// The renderer never gets file paths of its own: importing IPAs (Phase 9) opens a file dialog here, in main.

import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  app,
  BrowserWindow,
  dialog,
  MessageChannelMain,
  net,
  safeStorage,
  session,
  shell,
  type WebContents
} from 'electron'
import electronUpdater from 'electron-updater'

import { createFileDownloadStore } from '@desktop/main/adapters/file-download-store.ts'
import { createNodeHttpClient } from '@desktop/main/adapters/http-client.ts'
import { createDesktopEngine } from '@desktop/main/engine.ts'
import { createMainLogging, type MainLogging } from '@desktop/main/logger.ts'
import { createIpaChooser } from '@desktop/main/rpc/choose-ipas.ts'
import { createIpaResolver } from '@desktop/main/rpc/resolve-ipa.ts'
import { serveEngine } from '@desktop/main/rpc/serve-engine.ts'
import { createDesktopSecrets } from '@desktop/main/secrets.ts'
import {
  lockDownWebContents,
  restrictPermissions
} from '@desktop/main/security.ts'
import { trustSystemCertificates } from '@desktop/main/system-trust.ts'
import { electronUpdaterPort } from '@desktop/main/updates/electron-updater.ts'
import { createFetchJson } from '@desktop/main/updates/fetch-json.ts'
import { installKind } from '@desktop/main/updates/install-kind.ts'
import { serveUpdateState } from '@desktop/main/updates/serve-updates.ts'
import { createSigstoreVerifier } from '@desktop/main/updates/sigstore-verifier.ts'
import { createUpdateService } from '@desktop/main/updates/update-service.ts'
import { createMainWindow } from '@desktop/main/window.ts'
import type { Logger } from '@ipaforge/kernel'

/** Wires the Engine (needs the app to be ready: safeStorage) and returns how a window connects to it. */
const createEngineConnector = ({ logger, logs }: MainLogging) => {
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
      logs,
      chooseIpas: createIpaChooser({
        showOpenDialog: (options) => {
          const window = BrowserWindow.fromWebContents(contents)
          const settings = {
            properties: [...options.properties],
            filters: options.filters.map((filter) => ({
              ...filter,
              extensions: [...filter.extensions]
            }))
          }

          return window
            ? dialog.showOpenDialog(window, settings)
            : dialog.showOpenDialog(settings)
        }
      }),
      logger,
      createChannel: () => new MessageChannelMain()
    })
}

/** The text of a file, if it is there. */
const readText = (path: string): string | undefined => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

/** Updating on launch, each update checked against its release's Sigstore signature; a development build has nothing to update. */
const createUpdates = (logger: Logger) =>
  createUpdateService({
    updater: app.isPackaged
      ? electronUpdaterPort(electronUpdater.autoUpdater, logger)
      : undefined,
    verifier: createSigstoreVerifier({
      fetchJson: createFetchJson((url) => net.fetch(url)),
      readFile,
      tufCachePath: join(app.getPath('userData'), 'sigstore')
    }),
    kind: installKind({
      platform: process.platform,
      appImage: process.env.APPIMAGE,
      resourcesPath: process.resourcesPath,
      execPath: process.execPath,
      productName: app.getName(),
      exists: existsSync,
      readText
    }),
    arch: process.arch,
    translated: app.runningUnderARM64Translation,
    logger
  })

const openWindow = (
  logger: Logger,
  connect: (contents: WebContents) => void
): void => {
  createMainWindow(logger, connect).catch((error: unknown) =>
    logger.error('could not open the window', { error })
  )
}

const start = (logging: MainLogging): void => {
  const { logger } = logging
  trustSystemCertificates(logger)
  app.on('web-contents-created', (_event, contents) =>
    lockDownWebContents(contents, logger, (url) => shell.openExternal(url))
  )
  // macOS keeps the app running without windows; every other OS quits with the last one.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app
    .whenReady()
    .then(() => {
      restrictPermissions(session.defaultSession, logger)
      logger.info('ready', {
        electron: process.versions.electron,
        platform: process.platform
      })
      const connectEngine = createEngineConnector(logging)
      const updates = createUpdates(logger)
      // The window shows the update screen until the check is done, and the update if there is one.
      updates.start()
      const connect = (contents: WebContents) => {
        connectEngine(contents)
        serveUpdateState(contents, updates, () => new MessageChannelMain())
      }
      // Quitting to install an update replaces the app's files: no window may open from them meanwhile.
      let isQuitting = false
      app.on('before-quit', () => {
        isQuitting = true
      })
      app.on('activate', () => {
        if (!isQuitting && BrowserWindow.getAllWindows().length === 0)
          openWindow(logger, connect)
      })
      openWindow(logger, connect)
    })
    .catch((error: unknown) => logger.error('could not start', { error }))
}

start(createMainLogging())
