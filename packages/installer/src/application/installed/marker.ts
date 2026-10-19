// IPAForge's mark on an app it installs: an `IPAForge` dictionary in the app's Info.plist with its original bundle id
// and where it came from. It travels with the app, so IPAForge on any computer can tell its apps apart and refresh
// them from where they came from (the catalog, a source link), even without the IPA it kept on the first computer.
import type { AppJob, AppMarker, AppOrigin } from '@installer/domain/types.ts'
import {
  compact,
  createDict,
  isPlistDict,
  type PlistDict,
  type PlistValue
} from '@ipaforge/kernel'
import type { BundleAddition, BundleAdditions } from '@ipaforge/signer'

export const MARKER_KEY = 'IPAForge'
const MARKER_VERSION = 1
const MAIN_BUNDLE = ''

/** Where the job's app came from, as it's remembered and marked. */
export const originOf = (job: AppJob): AppOrigin => {
  const { source } = job

  if (source.kind === 'catalog')
    return compact({
      kind: 'catalog' as const,
      appId: source.appId,
      channel: job.release?.channel ?? source.channel
    })
  if (source.kind === 'installed') return source.record.origin

  return source.origin ?? { kind: 'file', name: source.file.name }
}

const originDict = (origin: AppOrigin): PlistDict => {
  if (origin.kind === 'catalog')
    return createDict(
      Object.entries(
        compact({
          Kind: 'catalog',
          AppID: origin.appId,
          Channel: origin.channel
        })
      )
    )
  if (origin.kind === 'url')
    return createDict([
      ['Kind', 'url'],
      ['URL', origin.url]
    ])

  return createDict([
    ['Kind', 'file'],
    ['Name', origin.name]
  ])
}

/** The mark written into the app's Info.plist; the certificate is the one the app is signed with. */
export const markerFor = (
  originalBundleId: string,
  origin: AppOrigin,
  certificateSerial: string | undefined
): PlistDict =>
  createDict([
    ['Version', MARKER_VERSION],
    ['OriginalBundleID', originalBundleId],
    ['Origin', originDict(origin)],
    ...(certificateSerial
      ? [['CertificateSerial', certificateSerial] as const]
      : [])
  ])

const text = (dict: PlistDict, key: string): string | undefined => {
  const value = dict[key]

  return typeof value === 'string' && value !== '' ? value : undefined
}

const readOrigin = (dict: PlistDict): AppOrigin | undefined => {
  const kind = text(dict, 'Kind')
  const appId = text(dict, 'AppID')
  const url = text(dict, 'URL')
  const name = text(dict, 'Name')
  const channel = text(dict, 'Channel')

  if (kind === 'catalog' && appId)
    return channel === 'stable' || channel === 'nightly'
      ? { kind: 'catalog', appId, channel }
      : { kind: 'catalog', appId }
  if (kind === 'url' && url) return { kind: 'url', url }
  if (kind === 'file' && name) return { kind: 'file', name }

  return undefined
}

/** IPAForge's mark on an installed app (its Info.plist as the device returned it), if it has one. */
export const readMarker = (raw: PlistDict): AppMarker | undefined => {
  const marker: PlistValue | undefined = raw[MARKER_KEY]

  if (!isPlistDict(marker)) return undefined

  const originalBundleId = text(marker, 'OriginalBundleID')
  const origin = isPlistDict(marker.Origin)
    ? readOrigin(marker.Origin)
    : undefined

  if (!(originalBundleId && origin)) return undefined

  const certificateSerial = text(marker, 'CertificateSerial')

  return certificateSerial
    ? { originalBundleId, origin, certificateSerial }
    : { originalBundleId, origin }
}

/** Adds the mark to the main app's Info.plist, next to anything else being added (SideStore's certificate). */
export const withMarker =
  (
    additions: BundleAdditions | undefined,
    marker: PlistDict
  ): BundleAdditions =>
  (bundles) => {
    const others = additions?.(bundles) ?? []
    const main = others.find((addition) => addition.bundlePath === MAIN_BUNDLE)
    const marked: BundleAddition = {
      ...main,
      bundlePath: MAIN_BUNDLE,
      infoPlist: createDict([
        ...Object.entries(main?.infoPlist ?? {}),
        [MARKER_KEY, marker]
      ])
    }

    return [...others.filter((addition) => addition !== main), marked]
  }
