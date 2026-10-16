// Electron renderer: a sandboxed browser context. It waits for the rpc MessagePort the preload forwards, connects
// an EngineClient to the Engine in the main process over it, then mounts the UI with the browser services.
import '@loadstar/ui/styles.css'

import { createHashHistory } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import {
  messagePortTransport,
  receiveEnginePort
} from '@desktop/renderer/engine-port.ts'
import type { LogLevel } from '@loadstar/kernel'
import { createEngineClient } from '@loadstar/rpc'
import { App, createBrowserServices, prepareLanguage } from '@loadstar/ui'

const ROOT_ELEMENT_ID = 'root'
/** Verbose while developing, quieter in a production build. */
const LOG_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'info'
const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev'

const container = document.getElementById(ROOT_ELEMENT_ID)
if (!container) throw new Error(`missing #${ROOT_ELEMENT_ID} in index.html`)

const mount = async () => {
  const port = await receiveEnginePort(window)
  const services = createBrowserServices(window, {
    logLevel: LOG_LEVEL,
    engine: (logger) =>
      createEngineClient(messagePortTransport(port), { logger }),
    appVersion: APP_VERSION
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
