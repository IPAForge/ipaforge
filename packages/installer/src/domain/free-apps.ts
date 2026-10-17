// The free-team app limit (research §5): iOS runs at most a few apps signed with free-team profiles per device,
// expired ones included. Which installed apps take a slot is worked out from the device's profiles.

import type {
  FreeProfileApp,
  FreeProfileRules,
  ProfileFacts
} from '@installer/domain/types.ts'
import { bundleIdOf } from '@loadstar/device'
import { compact } from '@loadstar/kernel'

const lifetimeMs = (profile: ProfileFacts): number | undefined =>
  profile.createdAt && profile.expiresAt
    ? profile.expiresAt.getTime() - profile.createdAt.getTime()
    : undefined

export const isFreeProfile = (
  profile: ProfileFacts,
  rules: FreeProfileRules
): boolean => {
  if (profile.teamId && rules.freeTeamIds.has(profile.teamId)) return true
  const lifetime = lifetimeMs(profile)

  return lifetime !== undefined && lifetime <= rules.maxLifetimeMs
}

/** Bundle IDs that a free profile provisions; wildcard profiles name no single app. */
export const freeProfileBundleIds = (
  profiles: readonly ProfileFacts[],
  rules: FreeProfileRules
): Set<string> =>
  new Set(
    profiles.flatMap((profile) => {
      if (!profile.applicationIdentifier || !isFreeProfile(profile, rules))
        return []
      const bundleId = bundleIdOf(profile.applicationIdentifier)

      return bundleId.includes('*') ? [] : [bundleId]
    })
  )

/**
 * The installed apps that hold a free-profile slot. The app being installed is left out: reinstalling or upgrading
 * it reuses its own slot.
 */
export const occupiedFreeSlots = (
  freeBundleIds: ReadonlySet<string>,
  installed: ReadonlyMap<string, { readonly name?: string }>,
  installing: string
): FreeProfileApp[] =>
  [...installed]
    .filter(
      ([bundleId]) => freeBundleIds.has(bundleId) && bundleId !== installing
    )
    .map(([bundleId, app]) => compact({ bundleId, name: app.name }))

/** True when installing one more app would go over `limit`. */
export const needsFreeSlot = (
  occupied: readonly FreeProfileApp[],
  limit: number
): boolean => occupied.length >= limit

/** Profiles that belong to `bundleId` or one of its extensions (`bundleId.*`). */
export const profilesOf = (
  profiles: readonly ProfileFacts[],
  bundleId: string
): string[] =>
  profiles
    .filter((profile) => {
      const id =
        profile.applicationIdentifier &&
        bundleIdOf(profile.applicationIdentifier)

      return id === bundleId || id?.startsWith(`${bundleId}.`) === true
    })
    .map((profile) => profile.uuid)
