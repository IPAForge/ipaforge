import type { AppView, RefreshBatch } from '@ui/features/apps/types.ts'
import type { RefreshDecision } from '@ui/services/engine/types.ts'

/**
 * Splits the apps to refresh by what the Engine decided: a new profile only, or installed again (and why). An app
 * with nothing to install it from can't be installed again, so it stays out. Without decisions (Apple didn't
 * answer) every app that can be is installed again, as before marks.
 */
export const refreshBatch = (
  views: readonly AppView[],
  decisions: readonly RefreshDecision[] | undefined
): RefreshBatch => {
  const byBundle = new Map(
    (decisions ?? []).map((decision) => [decision.bundleId, decision])
  )
  const decided = views.map((view) => ({
    view,
    decision: byBundle.get(view.app.bundleId)
  }))
  const canReinstall = (view: AppView) =>
    view.refresh !== undefined && view.refresh.kind !== 'profile'

  return {
    profiles: decided.flatMap(({ view, decision }) =>
      decision?.kind === 'profile' ? [view] : []
    ),
    reinstall: decided.flatMap(({ view, decision }) => {
      if (decision?.kind === 'profile' || !canReinstall(view)) return []

      return [
        {
          view,
          refresh: decision?.kind === 'reinstall' ? decision.reason : undefined
        }
      ]
    })
  }
}
