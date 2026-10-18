import { QueryClientProvider } from '@tanstack/react-query'
import type { RouterHistory } from '@tanstack/react-router'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

import { DeviceFeed } from '@ui/components/device-feed.tsx'
import { createQueryClient } from '@ui/hooks/queries/query-client.ts'
import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { LanguageProvider } from '@ui/i18n/provider/language-provider.tsx'
import type { LanguageSetup } from '@ui/i18n/setup/types.ts'
import { createAppRouter } from '@ui/router.tsx'
import { scopeServices } from '@ui/services/scope-services.ts'
import { type UiServices, UiServicesContext } from '@ui/services/ui-services.ts'
import { ActiveRunContext } from '@ui/state/active-run/active-run-context.ts'
import { createActiveRunStore } from '@ui/state/active-run/active-run-store.ts'
import { LogViewContext } from '@ui/state/log-view/log-view-context.ts'
import { createLogViewStore } from '@ui/state/log-view/log-view-store.ts'
import { PreloadContext } from '@ui/state/preload/preload-context.ts'
import { createPreloadStore } from '@ui/state/preload/preload-store.ts'
import { SelectionContext } from '@ui/state/selection/selection-context.ts'
import { createSelectionStore } from '@ui/state/selection/selection-store.ts'
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
 * The whole UI: host services (the Engine client among them), the query cache for Engine queries kept in step
 * with the device feed, what the user picked in the top bar, the install run (kept here so it goes on in other
 * sections), the preload list, the log viewer's filters, the language, the theme, then the router (whose root route is the shell). Touches no browser global
 * at import time, so any host can mount it. HeroUI v3 itself needs no provider.
 */
export const App = ({ services, language, history }: AppProps) => {
  const [scoped] = useState(() => scopeServices(services))
  const [router] = useState(() =>
    createAppRouter({ logger: scoped.logger, history })
  )
  const [queryClient] = useState(createQueryClient)
  const [selection] = useState(() =>
    createSelectionStore(scoped.preferences, scoped.logger)
  )
  // A run can add a session or find an Apple ID blocked on a device: refresh what the pickers show when it ends.
  const [activeRun] = useState(() =>
    createActiveRunStore({
      engine: scoped.engine,
      logger: scoped.logger,
      onSettled: () =>
        void queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
    })
  )

  const [logView] = useState(createLogViewStore)
  const [preload] = useState(createPreloadStore)

  return (
    <UiServicesContext value={scoped}>
      <QueryClientProvider client={queryClient}>
        <DeviceFeed />
        <SelectionContext value={selection}>
          <ActiveRunContext value={activeRun}>
            <PreloadContext value={preload}>
              <LogViewContext value={logView}>
                <LanguageProvider setup={language}>
                  <ThemeProvider>
                    <RouterProvider router={router} />
                  </ThemeProvider>
                </LanguageProvider>
              </LogViewContext>
            </PreloadContext>
          </ActiveRunContext>
        </SelectionContext>
      </QueryClientProvider>
    </UiServicesContext>
  )
}
