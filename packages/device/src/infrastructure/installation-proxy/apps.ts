// Installed apps as installation_proxy reports them (`Browse` and `Lookup` responses).
import {
  compact,
  isPlistDict,
  type PlistDict,
  type PlistValue,
  stringAt
} from '@loadstar/kernel'

export type InstalledApp = {
  readonly bundleId: string
  readonly name?: string
  readonly version?: string
  readonly shortVersion?: string
  readonly signerIdentity?: string
  /** Every attribute the device returned. */
  readonly raw: PlistDict
}

export const DEFAULT_APP_ATTRIBUTES = [
  'CFBundleIdentifier',
  'CFBundleDisplayName',
  'CFBundleName',
  'CFBundleVersion',
  'CFBundleShortVersionString',
  'SignerIdentity',
  'ApplicationType'
] as const

/** Empty strings count as missing. */
const nonEmpty = (value: string | undefined): string | undefined =>
  value || undefined

export const toInstalledApp = (raw: PlistDict): InstalledApp | undefined => {
  const bundleId = stringAt(raw, 'CFBundleIdentifier')
  if (!bundleId) return undefined
  return compact({
    bundleId,
    raw,
    name: nonEmpty(
      stringAt(raw, 'CFBundleDisplayName') ?? stringAt(raw, 'CFBundleName')
    ),
    version: nonEmpty(stringAt(raw, 'CFBundleVersion')),
    shortVersion: nonEmpty(stringAt(raw, 'CFBundleShortVersionString')),
    signerIdentity: nonEmpty(stringAt(raw, 'SignerIdentity'))
  })
}

const appsIn = (entries: readonly PlistValue[]): InstalledApp[] =>
  entries.flatMap((entry) => {
    const app = isPlistDict(entry) ? toInstalledApp(entry) : undefined

    return app ? [app] : []
  })

/** The apps in one `Browse` status message (`CurrentList`). */
export const browsedApps = (message: PlistDict): InstalledApp[] =>
  Array.isArray(message.CurrentList) ? appsIn(message.CurrentList) : []

/** The apps in one `Lookup` status message (`LookupResult`, keyed by bundle ID). */
export const lookedUpApps = (message: PlistDict): InstalledApp[] =>
  isPlistDict(message.LookupResult)
    ? appsIn(Object.values(message.LookupResult))
    : []
