// Composition root for the Engine: the Node adapters wired into every context, then into the installer.
import { join } from 'node:path'

import { createFileDownloadStore } from '@desktop/main/adapters/file-download-store.ts'
import { createFileScratchStore } from '@desktop/main/adapters/file-scratch-store.ts'
import { createFileSecretStore } from '@desktop/main/adapters/file-secret-store.ts'
import { createNodeHttpClient } from '@desktop/main/adapters/http-client.ts'
import { createNodeUsbmuxTransport } from '@desktop/main/adapters/usbmux-transport.ts'
import { createWebSocketFactory } from '@desktop/main/adapters/web-socket.ts'
import { createAppleAccounts } from '@ipaforge/apple'
import { createCatalog } from '@ipaforge/catalog'
import { createDeviceManager } from '@ipaforge/device'
import { createEngine, type Engine } from '@ipaforge/installer'
import { type Logger, type SecretStore, silentLogger } from '@ipaforge/kernel'

export type DesktopEngineOptions = {
  /** Accounts, sessions, certificates and their keys, pair records the OS would not keep. */
  readonly secrets: SecretStore
  /** Downloads go to `<dataDir>/downloads`, signed IPAs wait in `<dataDir>/scratch`, app sources in `<dataDir>/sources.json`. */
  readonly dataDir: string
  readonly logger?: Logger
}

export const createDesktopEngine = ({
  secrets,
  dataDir,
  logger = silentLogger
}: DesktopEngineOptions): Engine => {
  const http = createNodeHttpClient()

  return createEngine({
    devices: createDeviceManager({
      transport: createNodeUsbmuxTransport(),
      secrets,
      logger
    }),
    apple: createAppleAccounts({
      http,
      webSocket: createWebSocketFactory(),
      secrets,
      logger
    }),
    catalog: createCatalog({
      http,
      store: createFileDownloadStore(join(dataDir, 'downloads')),
      // App sources aren't secret: the same 0600 key/value file the anisette identity uses, a file of their own.
      sourceStore: createFileSecretStore(join(dataDir, 'sources.json')),
      logger
    }),
    secrets,
    scratch: createFileScratchStore(join(dataDir, 'scratch')),
    logger
  })
}
