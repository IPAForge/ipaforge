// Browser entry (`pnpm --filter @ipaforge/ui dev` and `build`): browser services with the fake Engine over the
// rpc memory transport, then the language, then <App/>. In development `?scenario=<id>` picks what the fake
// Engine plays (fake-scenarios.ts); a production build always plays the happy path.
import '@ui/styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import type { LogLevel } from '@ipaforge/kernel'
import { App } from '@ui/App.tsx'
import { prepareLanguage } from '@ui/i18n/setup/prepare-language.ts'
import { createBrowserServices } from '@ui/services/browser-services.ts'
import { createFakeEngineClient } from '@ui/services/engine/fake/fake-engine-client.ts'
import { scenarioFromSearch } from '@ui/services/engine/fake/fake-scenarios.ts'

const ROOT_ELEMENT_ID = 'root'
/** Verbose while developing, quieter in a production build. */
const LOG_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'info'
const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev'

const container = document.getElementById(ROOT_ELEMENT_ID)
if (!container) throw new Error(`missing #${ROOT_ELEMENT_ID} in index.html`)

const scenario = import.meta.env.DEV
  ? scenarioFromSearch(window.location.search)
  : 'happy'

const services = createBrowserServices(window, {
  logLevel: LOG_LEVEL,
  engine: (logger) => createFakeEngineClient({ scenario, logger }),
  appVersion: APP_VERSION
})

// The language's messages load before the first render, so English never flashes.
void prepareLanguage(services).then((language) =>
  createRoot(container).render(
    <StrictMode>
      <App services={services} language={language} />
    </StrictMode>
  )
)
