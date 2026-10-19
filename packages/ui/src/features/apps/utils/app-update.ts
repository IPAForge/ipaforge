import type { AppUpdate } from '@ui/features/apps/types.ts'
import { isNewerVersion } from '@ui/features/apps/utils/is-newer-version.ts'
import type { InstalledApp, SourceApps } from '@ui/services/engine/types.ts'

/** A newer version of an installed app in the sources that are on, by its original bundle id; the newest one. */
export const appUpdate = (
  app: InstalledApp,
  sources: readonly SourceApps[]
): AppUpdate | undefined => {
  const bundleId = app.record?.originalBundleId ?? app.marker?.originalBundleId
  const installed = app.version

  if (!(bundleId && installed)) return undefined

  let best: AppUpdate | undefined

  for (const source of sources)
    for (const candidate of source.apps) {
      const latest = candidate.versions[0]
      const isCandidate =
        candidate.bundleId === bundleId &&
        latest !== undefined &&
        isNewerVersion(latest.version, best?.version ?? installed)

      if (isCandidate)
        best = { version: latest.version, downloadUrl: latest.downloadUrl }
    }

  return best
}
