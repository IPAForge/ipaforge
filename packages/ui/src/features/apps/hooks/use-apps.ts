import { useTranslation } from 'react-i18next'

import type { AppView } from '@ui/features/apps/types.ts'
import { appUpdate } from '@ui/features/apps/utils/app-update.ts'
import {
  calendarDaysLeft,
  daysLeft,
  expiryTone
} from '@ui/features/apps/utils/expiry.ts'
import { originText } from '@ui/features/apps/utils/origin-text.ts'
import { refreshPlan } from '@ui/features/apps/utils/refresh-plan.ts'
import { useCatalogApps } from '@ui/hooks/queries/use-catalog-apps.ts'
import { useInstalledApps } from '@ui/hooks/queries/use-installed-apps.ts'
import { useSourceApps } from '@ui/hooks/queries/use-source-apps.ts'
import { useTeams } from '@ui/hooks/queries/use-teams.ts'
import { useAutoRefreshSettings } from '@ui/hooks/use-auto-refresh-settings.ts'
import { useActiveAccount, useDeviceInUse } from '@ui/hooks/use-selection.ts'

const NO_TEAMS: readonly string[] = []

/**
 * The Apps page's data: the device and Apple ID in use, the apps IPAForge installed there (each with its days left,
 * how close it is to expiring, where it came from and any update in the sources), the apps it has no copy of
 * (installed before it kept copies, or by another tool; with where they can be installed from again), and the ones
 * due for a refresh.
 */
export const useApps = () => {
  const { t } = useTranslation()
  const device = useDeviceInUse()
  const account = useActiveAccount()
  const teams = useTeams(account?.id).data
  const teamIds =
    teams?.kind === 'teams' ? teams.teams.map((team) => team.id) : NO_TEAMS
  const installed = useInstalledApps(
    device?.udid,
    teamIds,
    device?.isConnected ?? false
  )
  const sources = useSourceApps().data ?? []
  const catalogApps = useCatalogApps().data ?? []
  const catalogName = t('preload.sources.catalogName')
  const { settings } = useAutoRefreshSettings()
  const now = new Date()
  const views: AppView[] = (installed.data ?? []).map((app) => {
    const days = daysLeft(app.expiresAt, now)
    const from = originText(app, sources, catalogName)

    return {
      app,
      daysLeft: days,
      daysShown: calendarDaysLeft(app.expiresAt, now),
      tone: expiryTone(days, settings.daysBefore),
      from,
      update: appUpdate(app, sources),
      refresh: refreshPlan(app, from, catalogApps, sources, catalogName)
    }
  })
  // IPAForge's apps: kept on this computer, or marked by IPAForge on any computer.
  const isIPAForge = (view: AppView) =>
    view.app.record !== undefined || view.app.marker !== undefined
  const managed = views.filter(isIPAForge)

  return {
    device,
    account,
    settings,
    isLoading: installed.isPending && installed.fetchStatus !== 'idle',
    error: installed.error,
    managed,
    others: views.filter((view) => !isIPAForge(view)),
    // Only what can be refreshed here: an .ipa from another computer has to be added first.
    due: managed.filter(
      (view) =>
        view.refresh !== undefined &&
        (view.tone === 'soon' || view.tone === 'expired')
    ),
    expired: managed.filter((view) => view.tone === 'expired'),
    updates: managed.filter((view) => view.update !== undefined)
  }
}
