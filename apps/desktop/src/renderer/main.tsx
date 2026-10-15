// Electron renderer: a sandboxed browser context, so it mounts the UI with the same browser services as the web entry.
import '@loadstar/ui/styles.css'

import { createHashHistory } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import type { LogLevel } from '@loadstar/kernel'
import { App, createBrowserServices, prepareLanguage } from '@loadstar/ui'

const ROOT_ELEMENT_ID = 'root'
/** Verbose while developing, quieter in a production build. */
const LOG_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'info'

const container = document.getElementById(ROOT_ELEMENT_ID)
if (!container) throw new Error(`missing #${ROOT_ELEMENT_ID} in index.html`)

const services = createBrowserServices(window, LOG_LEVEL)

// The language's messages load before the first render, so English never flashes.
// A build is loaded from file://, where only the hash can carry the route.
void prepareLanguage(services).then((language) =>
  createRoot(container).render(
    <StrictMode>
      <App
        services={services}
        language={language}
        history={createHashHistory()}
      />
    </StrictMode>
  )
)
