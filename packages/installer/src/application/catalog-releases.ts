// The latest release of a catalog app on each of its channels, for its details: version, the .ipa link, size and
// date. Each channel is looked up on its own (GitHub releases), so one that can't be read leaves the others.
import type { InstallerDeps } from '@installer/types.ts'
import type { Channel, ResolvedRelease } from '@ipaforge/catalog'
import { compact } from '@ipaforge/kernel'

export type CatalogRelease = {
  readonly channel: Channel
  readonly version: string
  readonly downloadUrl: string
  readonly size?: number
  readonly publishedAt?: Date
}

const CHANNELS: readonly Channel[] = ['stable', 'nightly']

const releaseOf = (release: ResolvedRelease): CatalogRelease =>
  compact({
    channel: release.channel,
    version: release.version,
    downloadUrl: release.url,
    size: release.size,
    publishedAt: release.publishedAt
  })

export const catalogReleases = async (
  deps: InstallerDeps,
  appId: string
): Promise<CatalogRelease[]> => {
  const app = (await deps.catalog.manifest()).apps.find(
    (candidate) => candidate.id === appId
  )
  const channels = CHANNELS.filter((channel) => app?.channels[channel])
  const releases: CatalogRelease[] = []

  for (const channel of channels)
    try {
      releases.push(releaseOf(await deps.catalog.resolve(appId, channel)))
    } catch {
      // That channel can't be read now (offline, rate-limited): the details show the others.
    }

  return releases
}
