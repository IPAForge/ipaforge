// Electron renderer: a sandboxed browser context. It waits for the rpc and update MessagePorts the preload forwards,
// connects an EngineClient to the Engine in the main process and follows the updater over them, then mounts the UI
// with the browser services.
import '@ipaforge/ui/styles.css'

import { createHashHistory } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import {
  messagePortTransport,
  receiveEnginePort,
  receivePort
} from '@desktop/renderer/engine-port.ts'
import {
  FILE_PATHS_GLOBAL,
  type FilePaths
} from '@desktop/shared/file-paths.ts'
import { UPDATES_PORT_CHANNEL } from '@desktop/shared/updates-channel.ts'
import type { LogLevel } from '@ipaforge/kernel'
import { createEngineClient, createUpdateClient } from '@ipaforge/rpc'
import { App, createBrowserServices, prepareLanguage } from '@ipaforge/ui'

const ROOT_ELEMENT_ID = 'root'
/** Verbose while developing, quieter in a production build. */
const LOG_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'info'
const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev'

const container = document.getElementById(ROOT_ELEMENT_ID)
if (!container) throw new Error(`missing #${ROOT_ELEMENT_ID} in index.html`)

/** The preload's one function, if it is there (it always is in the app; not in a plain browser). */
const filePaths = () =>
  (window as unknown as Partial<Record<string, FilePaths>>)[FILE_PATHS_GLOBAL]

const mount = async () => {
  // Both listen before either port arrives: main posts them together.
  const [port, updatesPort] = await Promise.all([
    receiveEnginePort(window),
    receivePort(window, UPDATES_PORT_CHANNEL)
  ])
  const services = createBrowserServices(window, {
    logLevel: LOG_LEVEL,
    engine: (logger) =>
      createEngineClient(messagePortTransport(port), { logger }),
    updates: createUpdateClient(messagePortTransport(updatesPort)),
    appVersion: APP_VERSION,
    // A path only for a file the user dropped; anything else gives "" (unusable).
    droppedFilePath: (file) => filePaths()?.pathOf(file) || undefined
  })
  // The language's messages load before the first render, so English never flashes.
  const language = await prepareLanguage(services)
  // A build is loaded from file://, where only the hash can carry the route.
  createRoot(container).render(
    <StrictMode>
      <App
        services={services}
        language={language}
        history={createHashHistory()}
      />
    </StrictMode>
  )
}

void mount()
