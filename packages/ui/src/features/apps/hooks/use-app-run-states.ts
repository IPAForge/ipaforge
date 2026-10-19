import { useMutationState } from '@tanstack/react-query'

import { REFRESH_PLAN_KEY } from '@ui/features/apps/constants.ts'
import type { AppRunState } from '@ui/features/apps/types.ts'
import { groupSteps } from '@ui/features/install/run/utils/group-steps.ts'
import { useRun } from '@ui/hooks/use-run.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import { isRunActive } from '@ui/state/active-run/run-view.ts'
import type { StepView } from '@ui/state/active-run/types.ts'

/** An app's place in the run: done, waiting for its turn, or which of its steps runs and how far it is. */
const stateOf = (steps: readonly StepView[]): AppRunState => {
  const done = steps.filter(
    (step) => step.state === 'done' || step.state === 'skipped'
  ).length
  const current = steps.find(
    (step) => step.state === 'active' || step.state === 'waiting'
  )

  if (steps.length > 0 && done === steps.length) return { kind: 'done' }
  if (!current) return { kind: 'waiting' }

  return {
    kind: 'running',
    labelKey: current.labelKey as TranslationKey,
    fraction: (done + current.fraction) / steps.length
  }
}

/** The key an update's run state is under: its download link (the run doesn't know the app's bundle id yet). */
export const runKeyOfUrl = (url: string) => `url:${url}`

/** The key a catalog app's run state is under (an app installed again from the catalog). */
export const runKeyOfCatalog = (appId: string) => `catalog:${appId}`

/**
 * For each app the run (started from the Apps page or by automatic refresh) refreshes, by bundle id, or updates,
 * by its download link; before a refresh starts, the apps Apple is being asked about.
 */
export const useAppRunStates = (): ReadonlyMap<string, AppRunState> => {
  const { run } = useRun()
  const checking = useMutationState({
    filters: { mutationKey: REFRESH_PLAN_KEY, status: 'pending' },
    select: (mutation) =>
      (mutation.state.variables as { bundleIds?: readonly string[] })
        ?.bundleIds ?? []
  }).flat()

  if (checking.length > 0)
    return new Map(
      checking.map((bundleId) => [bundleId, { kind: 'checking' } as const])
    )
  if (run?.kind !== 'apps' || !isRunActive(run.view)) return new Map()

  const groups = groupSteps(run.view.steps, run.apps)

  return new Map(
    groups.flatMap((group) => {
      const source = group.app?.source

      if (source?.kind === 'installed')
        return [[source.bundleId, stateOf(group.steps)] as const]
      if (source?.kind === 'url')
        return [[runKeyOfUrl(source.url), stateOf(group.steps)] as const]
      if (source?.kind === 'catalog')
        return [[runKeyOfCatalog(source.appId), stateOf(group.steps)] as const]

      return []
    })
  )
}
