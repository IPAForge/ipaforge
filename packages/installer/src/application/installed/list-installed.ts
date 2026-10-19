// The Apps page's list: every app on the device signed with one of the user's teams, read from the device itself
// (its provisioning profiles say which team signed an app and when it expires), with the Engine's record of the
// apps it installed. A record whose app is no longer on the device is forgotten, with its kept IPA.

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
    const profiles = latestProfiles(
      await handle.listProfiles(),
      new Set(teamIds)
    )
    const wanted = [...new Set([...profiles.keys(), ...recordOf.keys()])]
    // installation_proxy only answers for apps (not extensions), so the extensions' own profiles drop out here.
    const onDevice = await handle.lookupApps(wanted)

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
        const teamId = profile?.teamId

        if (!teamId) return []

        const marker = readMarker(app.raw, { bundleId: app.bundleId, teamId })

        return [
          compact({
            bundleId: app.bundleId,
            name: app.name ?? record?.name ?? app.bundleId,
            version: app.shortVersion ?? app.version ?? record?.version,
            teamId,
            expiresAt: profile.expiresAt,
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
