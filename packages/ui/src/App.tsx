import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RouterHistory } from '@tanstack/react-router'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

import { LanguageProvider } from '@ui/i18n/provider/language-provider.tsx'
import type { LanguageSetup } from '@ui/i18n/setup/prepare-language.ts'
import { createAppRouter } from '@ui/router.tsx'
import { scopeServices } from '@ui/services/scope-services.ts'
import { type UiServices, UiServicesContext } from '@ui/services/ui-services.ts'
import { ThemeProvider } from '@ui/theme/provider/theme-provider.tsx'

export type AppProps = {
  /** The host's services: browser ones from `createBrowserServices`, the Electron renderer's own, or test doubles. */
  services: UiServices
  /** From `await prepareLanguage(services)`: the language shown first, already loaded. */
  language: LanguageSetup
  /** Defaults to the browser history; tests pass a memory history, a `file://` renderer a hash history. */
  history?: RouterHistory
}

/**
 * The whole UI: host services, the query cache, the language, the theme, then the router (whose root route is the shell).
 * Touches no browser global at import time, so any host can mount it. HeroUI v3 itself needs no provider.
 */
export const App = ({ services, language, history }: AppProps) => {
  const [scoped] = useState(() => scopeServices(services))
  const [router] = useState(() =>
    createAppRouter({ logger: scoped.logger, history })
  )
  const [queryClient] = useState(() => new QueryClient())

  return (
    <UiServicesContext value={scoped}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider setup={language}>
          <ThemeProvider>
            <RouterProvider router={router} />
          </ThemeProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </UiServicesContext>
  )
}
