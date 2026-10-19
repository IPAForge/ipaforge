import {
  runKeyOfCatalog,
  runKeyOfUrl
} from '@ui/features/apps/hooks/use-app-run-states.ts'
import type { AppRunState, AppView } from '@ui/features/apps/types.ts'

/** Where an app is in the run going on: refreshed by bundle id, updated by its new link, or installed again from its source. */
export const runStateOf = (
  view: AppView,
  states: ReadonlyMap<string, AppRunState>
): AppRunState | undefined => {
  const byBundle = states.get(view.app.bundleId)

  if (byBundle) return byBundle
  if (view.update) return states.get(runKeyOfUrl(view.update.downloadUrl))

  const source =
    view.refresh?.kind === 'source' ? view.refresh.source : undefined

  if (source?.kind === 'url') return states.get(runKeyOfUrl(source.url))
  if (source?.kind === 'catalog')
    return states.get(runKeyOfCatalog(source.appId))

  return undefined
}
