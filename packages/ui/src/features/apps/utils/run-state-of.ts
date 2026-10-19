import {
  runKeyOfCatalog,
  runKeyOfUrl
} from '@ui/features/apps/hooks/use-app-run-states.ts'
import type { AppRunState, AppView } from '@ui/features/apps/types.ts'
import type { AppSource } from '@ui/services/engine/types.ts'

/** The run state under a source's key: its link, or its catalog app. */
const stateOfSource = (
  source: AppSource,
  states: ReadonlyMap<string, AppRunState>
): AppRunState | undefined => {
  if (source.kind === 'url') return states.get(runKeyOfUrl(source.url))
  if (source.kind === 'catalog')
    return states.get(runKeyOfCatalog(source.appId))

  return undefined
}

/** Where an app is in the run going on: refreshed by bundle id, updated by its new link, or installed again from its source. */
export const runStateOf = (
  view: AppView,
  states: ReadonlyMap<string, AppRunState>
): AppRunState | undefined => {
  const byBundle = states.get(view.app.bundleId)

  if (byBundle) return byBundle
  if (view.update) return states.get(runKeyOfUrl(view.update.downloadUrl))

  const plan = view.refresh?.kind === 'source' ? view.refresh : undefined
  // Any source it could be installed from: the one picked may not be the first.
  const sources =
    plan?.choices?.map((choice) => choice.source) ?? (plan ? [plan.source] : [])

  for (const source of sources) {
    const state = stateOfSource(source, states)

    if (state) return state
  }

  return undefined
}
