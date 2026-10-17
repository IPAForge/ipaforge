import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect
} from '@tanstack/react-router'
import type { ComponentType } from 'react'

import { compact } from '@loadstar/kernel'
import { AppShell } from '@ui/components/shell/app-shell.tsx'
import { AccountsPage } from '@ui/features/accounts/accounts-page.tsx'
import { CertificatesPage } from '@ui/features/certificates/certificates-page.tsx'
import { DevicesPage } from '@ui/features/devices/devices-page.tsx'
import { InstallPage } from '@ui/features/install/install-page.tsx'
import { LogsPage } from '@ui/features/logs/logs-page.tsx'
import { PreloadPage } from '@ui/features/preload/preload-page.tsx'
import { SettingsPage } from '@ui/features/settings/settings-page.tsx'
import { homePath, sections } from '@ui/sections.ts'
import type { AppRouter, AppRouterOptions, SectionId } from '@ui/types.ts'

const sectionPages = {
  install: InstallPage,
  preload: PreloadPage,
  devices: DevicesPage,
  accounts: AccountsPage,
  certificates: CertificatesPage,
  logs: LogsPage,
  settings: SettingsPage
} as const satisfies Readonly<Record<SectionId, ComponentType>>

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  )
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: homePath })
  }
})

const sectionRoutes = sections.map((section) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: section.path,
    component: sectionPages[section.id]
  })
)

const routeTree = rootRoute.addChildren([indexRoute, ...sectionRoutes])

/** Code-based routes: `/` redirects home, one route per sidebar section, all inside the shell. */
export const createAppRouter = ({ logger, history }: AppRouterOptions) => {
  const router = createRouter(compact({ routeTree, history }))
  const log = logger.child({ scope: 'router' })
  router.subscribe('onResolved', ({ fromLocation, toLocation }) =>
    log.debug(
      'navigated',
      compact({ from: fromLocation?.pathname, to: toLocation.pathname })
    )
  )
  return router
}

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: module augmentation merges into an interface, so it must stay one
  interface Register {
    router: AppRouter
  }
}
