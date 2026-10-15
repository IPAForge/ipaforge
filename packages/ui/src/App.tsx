import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RouterHistory } from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { createAppRouter } from "@ui/router.tsx";
import { type UiServices, UiServicesContext } from "@ui/services/ui-services.ts";
import { ThemeProvider } from "@ui/theme/theme-provider.tsx";
import { useState } from "react";

const UI_LOG_SCOPE = "ui";

const scopeServices = (services: UiServices): UiServices => ({
  ...services,
  logger: services.logger.child({ scope: UI_LOG_SCOPE }),
});

export interface AppProps {
  /** The host's services: browser ones from `createBrowserServices`, the Electron renderer's own, or test doubles. */
  readonly services: UiServices;
  /** Defaults to the browser history; tests pass a memory history, a `file://` renderer a hash history. */
  readonly history?: RouterHistory;
}

/**
 * The whole UI: host services, the query cache, the theme, then the router (whose root route is the shell).
 * Touches no browser global at import time, so any host can mount it. HeroUI v3 itself needs no provider.
 */
export const App = ({ services, history }: AppProps) => {
  const [scoped] = useState(() => scopeServices(services));
  const [router] = useState(() => createAppRouter({ logger: scoped.logger, history }));
  const [queryClient] = useState(() => new QueryClient());
  return (
    <UiServicesContext value={scoped}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </UiServicesContext>
  );
};
