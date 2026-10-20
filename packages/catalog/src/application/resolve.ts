// Which release to download: the primary source first, then each mirror. A source that has gone, has no matching
// asset, or publishes no checksum is skipped; only verifiable releases are returned. With a version (Refresh,
// which never changes it), a channel whose releases are tagged by version is looked up by that tag (`1.2` or
// `v1.2`); a channel with one fixed tag (Nightly) gives what it has, and the installer checks the version it got.

import type {
  Attempt,
  Origin,
  Skip,
  Source
} from '@catalog/application/types.ts'
import type { ResolvedRelease } from '@catalog/domain/release.ts'
import type {
  CatalogApp,
  Channel,
  GithubLocation,
  ReleaseLocation,
  UrlLocation
} from '@catalog/domain/types.ts'
import { findGithubAsset } from '@catalog/infrastructure/github.ts'
import type { CatalogDeps } from '@catalog/types.ts'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const sourcesOf = (app: CatalogApp, channel: Channel): Source[] => {
  const release = app.channels[channel]
  if (!release) {
    throw new IPAForgeError(ErrorCode.CatalogUnavailable, {
      message: `${app.name} has no ${channel} channel`,
      data: { appId: app.id, channel }
    })
  }
  return [
    { location: release, from: 'primary' },
    ...(release.mirrors ?? []).map(
      (location): Source => ({ location, from: 'mirror' })
    )
  ]
}

const fileNameOf = (url: string, fallback: string): string =>
  new URL(url).pathname.split('/').pop() || fallback

const fromUrl = (
  app: CatalogApp,
  channel: Channel,
  location: UrlLocation,
  from: Origin
): Attempt => {
  const release: ResolvedRelease = compact({
    appId: app.id,
    channel,
    version: 'url',
    url: location.url,
    fileName: fileNameOf(location.url, `${app.id}.ipa`),
    size: location.size,
    sha256: location.sha256.toLowerCase(),
    from
  })

  return { release }
}

/** The release with this version's tag (`1.2`, else `v1.2`), or the location's own release without a version. */
const lookupGithub = async (
  deps: CatalogDeps,
  location: GithubLocation,
  version: string | undefined,
  signal?: AbortSignal
) => {
  if (!version || location.github.tag)
    return findGithubAsset(deps, location.github, signal)
  const exact = await findGithubAsset(
    deps,
    { ...location.github, tag: version },
    signal
  )
  if (exact.kind !== 'gone') return exact

  return findGithubAsset(
    deps,
    { ...location.github, tag: `v${version}` },
    signal
  )
}

const fromGithub = async (
  deps: CatalogDeps,
  app: CatalogApp,
  channel: Channel,
  location: GithubLocation,
  from: Origin,
  version: string | undefined,
  signal?: AbortSignal
): Promise<Attempt> => {
  const { repo } = location.github
  const lookup = await lookupGithub(deps, location, version, signal)
  if (lookup.kind !== 'found')
    return { skip: { source: repo, reason: lookup.kind } }
  const checksum = location.sha256?.toLowerCase() ?? lookup.asset.sha256
  if (!checksum) return { skip: { source: repo, reason: 'no-checksum' } }
  const { asset } = lookup
  const release: ResolvedRelease = compact({
    appId: app.id,
    channel,
    version: asset.version,
    url: asset.url,
    fileName: asset.name,
    size: asset.size,
    sha256: checksum,
    publishedAt: asset.publishedAt,
    from
  })

  return { release }
}

const isUrlLocation = (location: ReleaseLocation): location is UrlLocation =>
  'url' in location

const attempt = async (
  deps: CatalogDeps,
  app: CatalogApp,
  channel: Channel,
  { location, from }: Source,
  version: string | undefined,
  signal?: AbortSignal
): Promise<Attempt> =>
  isUrlLocation(location)
    ? fromUrl(app, channel, location, from)
    : fromGithub(deps, app, channel, location, from, version, signal)

const noReleaseError = (
  app: CatalogApp,
  channel: Channel,
  skipped: readonly Skip[]
): IPAForgeError =>
  new IPAForgeError(
    skipped.some((skip) => skip.reason === 'no-checksum')
      ? ErrorCode.ChecksumMissing
      : ErrorCode.ReleaseSourceGone,
    {
      message: `no usable source for ${app.name} (${channel})`,
      data: { appId: app.id, channel, skipped }
    }
  )

export const resolveRelease = async (
  deps: CatalogDeps,
  app: CatalogApp,
  channel: Channel,
  signal?: AbortSignal,
  version?: string
): Promise<ResolvedRelease> => {
  const skipped: Skip[] = []
  for (const source of sourcesOf(app, channel)) {
    const result = await attempt(deps, app, channel, source, version, signal)
    if ('release' in result) return result.release
    skipped.push(result.skip)
    deps.logger.warn('release source unusable; trying the next one', {
      appId: app.id,
      ...result.skip
    })
  }
  throw noReleaseError(app, channel, skipped)
}
