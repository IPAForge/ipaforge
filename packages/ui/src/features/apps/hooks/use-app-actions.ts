import { useIsMutating, useMutation } from '@tanstack/react-query'

import { REFRESH_PLAN_KEY } from '@ui/features/apps/constants.ts'
import type { AppView } from '@ui/features/apps/types.ts'
import { refreshBatch } from '@ui/features/apps/utils/refresh-batch.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import { useRun } from '@ui/hooks/use-run.ts'
import { useActiveAccount, useDeviceInUse } from '@ui/hooks/use-selection.ts'
import type { AppSource } from '@ui/services/engine/types.ts'

/** What Refresh installs for an app: its kept copy, or its catalog app or source link. */
const refreshSource = (view: AppView): AppSource =>
  view.refresh?.kind === 'source'
    ? view.refresh.source
    : { kind: 'installed', bundleId: view.app.bundleId }

/**
 * Refresh and Update start the same install run as Preload. Refresh asks the Engine first which apps only need a
 * new profile (their certificate still holds) and installs the others again from their kept IPA or source; Update
 * installs the newer version from its source. All keep the app's data (same bundle id, same team).
 */
export const useAppActions = () => {
  const { startApps } = useRun()
  const engine = useEngine()
  const device = useDeviceInUse()
  const account = useActiveAccount()
  // Asking Apple takes a few seconds: the rows say so, and Refresh can't be pressed again meanwhile.
  const plan = useMutation({
    mutationKey: REFRESH_PLAN_KEY,
    mutationFn: (query: Parameters<typeof engine.refreshPlan>[0]) =>
      engine.refreshPlan(query)
  })
  const isPlanning = useIsMutating({ mutationKey: REFRESH_PLAN_KEY }) > 0

  /** Refreshes the apps that can be refreshed here (an .ipa from another computer can't until it's added). */
  const refresh = async (views: readonly AppView[]) => {
    const candidates = views.filter((view) => view.refresh)
    const first = candidates[0]

    if (!(device && account && first) || isPlanning) return

    const target = {
      udid: device.udid,
      accountId: account.id,
      teamId: first.app.teamId
    }
    // Without Apple's answer, apps are installed again (the run then shows what's wrong with the account).
    const decisions = await plan
      .mutateAsync({
        ...target,
        bundleIds: candidates.map((view) => view.app.bundleId)
      })
      .catch(() => undefined)
    const { reinstall, profiles } = refreshBatch(candidates, decisions)

    if (reinstall.length + profiles.length === 0) return
    // The Engine numbers the apps installed again first, then the ones getting new profiles.
    startApps(
      { ...target, apps: reinstall.map(({ view }) => refreshSource(view)) },
      [
        ...reinstall.map(({ view, refresh: kind }) => ({
          name: view.app.name,
          version: view.app.version,
          source: refreshSource(view),
          refresh: kind
        })),
        ...profiles.map((view) => ({
          name: view.app.name,
          version: view.app.version,
          source: { kind: 'installed', bundleId: view.app.bundleId } as const,
          refresh: 'profile' as const
        }))
      ],
      { profiles: profiles.map((view) => view.app.bundleId), fromApps: true }
    )
  }

  const update = (views: readonly AppView[]) => {
    const updates = views.filter((view) => view.update)
    const first = updates[0]
    const sourceOf = (view: AppView): AppSource => ({
      kind: 'url',
      url: view.update?.downloadUrl ?? ''
    })

    if (!(device && account && first)) return
    startApps(
      {
        udid: device.udid,
        accountId: account.id,
        teamId: first.app.teamId,
        apps: updates.map(sourceOf)
      },
      updates.map((view) => ({
        name: view.app.name,
        version: view.update?.version ?? view.app.version,
        source: sourceOf(view)
      })),
      { fromApps: true }
    )
  }

  return { refresh, update, isPlanning }
}
