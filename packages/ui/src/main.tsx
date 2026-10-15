// Browser entry (`pnpm --filter @loadstar/ui dev` and `build`): browser services and the language, then <App/>.
import '@ui/styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import type { LogLevel } from '@loadstar/kernel'
import { App } from '@ui/App.tsx'
import { prepareLanguage } from '@ui/i18n/setup/prepare-language.ts'
import { createBrowserServices } from '@ui/services/browser-services.ts'

const ROOT_ELEMENT_ID = 'root'
/** Verbose while developing, quieter in a production build. */
const LOG_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'info'

const container = document.getElementById(ROOT_ELEMENT_ID)
if (!container) throw new Error(`missing #${ROOT_ELEMENT_ID} in index.html`)

const services = createBrowserServices(window, LOG_LEVEL)

// The language's messages load before the first render, so English never flashes.
void prepareLanguage(services).then((language) =>
  createRoot(container).render(
    <StrictMode>
      <App services={services} language={language} />
    </StrictMode>
  )
)
