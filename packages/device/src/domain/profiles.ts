import {
  compact,
  isPlistDict,
  type PlistDict,
  type PlistLimits,
  parsePlist,
  utf8Encode
} from '@loadstar/kernel'

/** A provisioning profile installed on the device, as misagent returns it (summary only; the CMS is not verified). */
export type DeviceProfile = {
  readonly uuid: string
  readonly name: string
  readonly teamId?: string
  readonly appIdName?: string
  /** `application-identifier` entitlement, e.g. `ABCDE12345.com.example.app` (may contain `*`). */
  readonly applicationIdentifier?: string
  readonly expirationDate?: Date
  readonly raw: Uint8Array
}

const XML_START = utf8Encode('<?xml')
const PLIST_END = utf8Encode('</plist>')

const indexOf = (
  haystack: Uint8Array,
  needle: Uint8Array,
  from = 0
): number => {
  outer: for (let i = from; i <= haystack.byteLength - needle.byteLength; i++) {
    for (let j = 0; j < needle.byteLength; j++)
      if (haystack[i + j] !== needle[j]) continue outer
    return i
  }
  return -1
}

/** The XML plist embedded in a CMS-signed `.mobileprovision`, without parsing the CMS. */
export const embeddedProfilePlist = (
  profile: Uint8Array
): Uint8Array | undefined => {
  const start = indexOf(profile, XML_START)
  if (start < 0) return undefined
  const end = indexOf(profile, PLIST_END, start)
  if (end < 0) return undefined
  return profile.subarray(start, end + PLIST_END.byteLength)
}

/** The profile's plist dict, or `undefined` when it has none or it does not parse. */
const profileDict = (
  raw: Uint8Array,
  limits?: PlistLimits
): PlistDict | undefined => {
  const xml = embeddedProfilePlist(raw)
  if (!xml) return undefined
  try {
    const value = parsePlist(xml, limits)

    return isPlistDict(value) ? value : undefined
  } catch {
    return undefined
  }
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/** Summarises a profile, or returns `undefined` if it is not a readable provisioning profile. */
export const summarizeProfile = (
  raw: Uint8Array,
  limits?: PlistLimits
): DeviceProfile | undefined => {
  const dict = profileDict(raw, limits)
  if (!dict) return undefined
  const uuid = asString(dict.UUID)
  const name = asString(dict.Name)
  if (uuid === undefined || name === undefined) return undefined
  const team = Array.isArray(dict.TeamIdentifier)
    ? dict.TeamIdentifier[0]
    : undefined
  const entitlements = isPlistDict(dict.Entitlements)
    ? dict.Entitlements
    : undefined

  return compact({
    uuid,
    name,
    raw,
    teamId: asString(team),
    appIdName: asString(dict.AppIDName),
    applicationIdentifier: asString(entitlements?.['application-identifier']),
    expirationDate:
      dict.ExpirationDate instanceof Date ? dict.ExpirationDate : undefined
  })
}

/** Bundle ID part of an application identifier (`TEAMID.com.example.app` → `com.example.app`). */
export const bundleIdOf = (applicationIdentifier: string): string => {
  const dot = applicationIdentifier.indexOf('.')

  return dot < 0 ? applicationIdentifier : applicationIdentifier.slice(dot + 1)
}

export type RemoveStaleOptions = {
  readonly now: Date
  /** Also remove this team's profiles whose app is no longer installed. */
  readonly teamId?: string
}

const isExpired = (profile: DeviceProfile, now: Date): boolean =>
  profile.expirationDate !== undefined &&
  profile.expirationDate.getTime() <= now.getTime()

/** A `teamId` profile for a specific app (never a wildcard) that is not installed. */
const isOrphaned = (
  profile: DeviceProfile,
  installedBundleIds: ReadonlySet<string>,
  teamId?: string
): boolean => {
  if (!teamId || profile.teamId !== teamId || !profile.applicationIdentifier)
    return false
  const bundleId = bundleIdOf(profile.applicationIdentifier)

  return !bundleId.includes('*') && !installedBundleIds.has(bundleId)
}

/** Profiles to remove: expired ones, and (with `teamId`) the team's profiles for apps that are gone. */
export const staleProfiles = (
  profiles: readonly DeviceProfile[],
  installedBundleIds: ReadonlySet<string>,
  options: RemoveStaleOptions
): DeviceProfile[] =>
  profiles.filter(
    (profile) =>
      isExpired(profile, options.now) ||
      isOrphaned(profile, installedBundleIds, options.teamId)
  )
