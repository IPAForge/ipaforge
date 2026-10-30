// The Apps page's list: every app on the device signed with one of the user's teams, read from the device itself
// (its provisioning profiles say which team signed an app and when it expires), with the Engine's record of the
// apps it installed. iOS removes a profile once it expires, so an app left without one is still listed, by the team
// at the end of its bundle id (`com.example.app.TEAMID`, as sideloading renames it), as expired. A record whose app
// is no longer on the device is forgotten, with its kept IPA.

import { readMarker } from '@installer/application/installed/marker.ts'
import {
  forgetRecords,
  readRecords
} from '@installer/application/installed/records.ts'
import type { InstalledApp, InstalledRecord } from '@installer/domain/types.ts'
import type { InstallerDeps } from '@installer/types.ts'
import type { DeviceProfile } from '@ipaforge/device'
import { compact } from '@ipaforge/kernel'

/** The app a team's profile is for: `TEAMID.com.example.app` → `com.example.app` (wildcard profiles are skipped). */
const profiledApp = (
  profile: DeviceProfile,
  teams: ReadonlySet<string>
): { bundleId: string; teamId: string; expiresAt?: Date } | undefined => {
  const { teamId, applicationIdentifier, expirationDate } = profile

  if (!teamId || !teams.has(teamId) || !applicationIdentifier) return
  if (!applicationIdentifier.startsWith(`${teamId}.`)) return

  const bundleId = applicationIdentifier.slice(teamId.length + 1)

  if (bundleId.includes('*')) return

  return compact({ bundleId, teamId, expiresAt: expirationDate })
}

/** The team a sideloaded app was renamed for (`com.example.app.TEAMID` → `TEAMID`), when it's one of `teams`. */
const renamedFor = (
  bundleId: string,
  teams: ReadonlySet<string>
): string | undefined => {
  const teamId = bundleId.slice(bundleId.lastIndexOf('.') + 1)

  return teams.has(teamId) ? teamId : undefined
}

/** The latest-expiring profile of each app (a refresh installs a new one before the old is removed). */
const latestProfiles = (
  profiles: readonly DeviceProfile[],
  teams: ReadonlySet<string>
) => {
  const byApp = new Map<string, { teamId: string; expiresAt?: Date }>()

  for (const profile of profiles) {
    const app = profiledApp(profile, teams)

    if (!app) continue

    const known = byApp.get(app.bundleId)
    const isLater =
      !known?.expiresAt ||
      (app.expiresAt !== undefined && app.expiresAt > known.expiresAt)

    if (!known || isLater) byApp.set(app.bundleId, app)
  }

  return byApp
}

export const listInstalledApps = async (
  deps: InstallerDeps,
  udid: string,
  teamIds: readonly string[]
): Promise<InstalledApp[]> => {
  const records = await readRecords(deps, udid)
  const recordOf = new Map<string, InstalledRecord>(
    records.map((record) => [record.bundleId, record])
  )
  const handle = await deps.devices.open(udid, { autoPair: false })

  try {
    const teams = new Set(teamIds)
    const profiles = latestProfiles(await handle.listProfiles(), teams)
    const wanted = new Set([...profiles.keys(), ...recordOf.keys()])
    // installation_proxy only lists apps (not extensions), so the extensions' own profiles drop out here.
    const onDevice = new Map(
      (await handle.listApps('User'))
        .filter(
          (app) =>
            wanted.has(app.bundleId) ||
            renamedFor(app.bundleId, teams) !== undefined
        )
        .map((app) => [app.bundleId, app])
    )

    await forgetRecords(
      deps,
      udid,
      new Set(
        records.flatMap((record) =>
          onDevice.has(record.bundleId) ? [] : [record.bundleId]
        )
      )
    )

    return [...onDevice.values()]
      .flatMap((app) => {
        const profile = profiles.get(app.bundleId)
        const record = recordOf.get(app.bundleId)
        const teamId = profile?.teamId ?? renamedFor(app.bundleId, teams)

        if (!teamId) return []

        const marker = readMarker(app.raw, { bundleId: app.bundleId, teamId })

        return [
          compact({
            bundleId: app.bundleId,
            name: app.name ?? record?.name ?? app.bundleId,
            version: app.shortVersion ?? app.version ?? record?.version,
            teamId,
            expiresAt: profile?.expiresAt,
            profileGone: profile ? undefined : (true as const),
            record,
            marker
          })
        ]
      })
      .sort(
        (a, b) =>
          (a.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY) -
          (b.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY)
      )
  } finally {
    await handle.close()
  }
}
