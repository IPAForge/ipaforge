import type { AppUpdate } from '@ui/features/apps/types.ts'
import { isNewerVersion } from '@ui/features/apps/utils/is-newer-version.ts'
import type { InstalledApp, SourceApps } from '@ui/services/engine/types.ts'

/** The source an app came from: the one that lists the link it was installed from. */
const isOriginOf = (app: InstalledApp, source: SourceApps): boolean => {
  const origin = app.record?.origin ?? app.marker?.origin

  return (
    origin?.kind === 'url' &&
    source.apps.some((candidate) =>
      candidate.versions.some((version) => version.downloadUrl === origin.url)
    )
  )
}

/**
 * A newer version of an installed app, by its original bundle id; the newest one. Only IPAForge's own sources and
 * the source the app came from count: an update keeps the app's data, so a source you added for other apps can't
 * replace it.
 */
export const appUpdate = (
  app: InstalledApp,
  sources: readonly SourceApps[]
): AppUpdate | undefined => {
  const bundleId = app.record?.originalBundleId ?? app.marker?.originalBundleId
  const installed = app.version

  if (!(bundleId && installed)) return undefined

  let best: AppUpdate | undefined
  const trusted = sources.filter(
    (source) => source.builtin || isOriginOf(app, source)
  )

  for (const source of trusted)
    for (const candidate of source.apps) {
      const latest = candidate.versions[0]
      const isCandidate =
        candidate.bundleId === bundleId &&
        latest !== undefined &&
        isNewerVersion(latest.version, best?.version ?? installed)

      if (isCandidate)
        best = {
          version: latest.version,
          downloadUrl: latest.downloadUrl,
          replaces: bundleId
        }
    }

  return best
}
