// The Developer Portal page: what the Apple ID's team holds at Apple (certificates, App IDs, app groups, registered
// devices) and the provisioning profiles on a device, with the few changes the page offers: revoking a
// certificate, deleting an App ID, and removing profiles from the device.
import { createCertificateStore } from '@installer/application/certificate-store.ts'
import { createFlowRuntime } from '@installer/application/runtime.ts'
import { queryTeam } from '@installer/application/team.ts'
import type {
  DeviceProfileInfo,
  TeamAppGroups,
  TeamDevices,
  TeamQuery
} from '@installer/engine/types.ts'
import type { InstallerDeps } from '@installer/types.ts'
import type { DeveloperServices, Team } from '@ipaforge/apple'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

/** Runs `use` with the account's developer services and the queried team. */
export const withTeam = async <T>(
  deps: InstallerDeps,
  query: TeamQuery,
  use: (developer: DeveloperServices, team: Team) => Promise<T>
): Promise<T> => {
  const developer = await createFlowRuntime(deps).developer(query.accountId)

  return use(
    developer,
    await queryTeam(deps, developer, {
      accountId: query.accountId,
      requested: query.teamId
    })
  )
}

/** The serial of the certificate this computer keeps for the team (with its key), if any. */
export const storedSerial = async (
  deps: InstallerDeps,
  accountId: string,
  teamId: string
): Promise<string | undefined> =>
  (
    await createCertificateStore(deps.secrets, deps.logger).load(
      accountId,
      teamId
    )
  )?.certificate.serialNumber

export const revokeCertificate = (
  deps: InstallerDeps,
  query: TeamQuery,
  serialNumber: string
): Promise<void> =>
  withTeam(deps, query, async (developer, team) => {
    await developer.revokeCertificate(team, serialNumber)
    deps.logger.info('certificate revoked from the Developer Portal page', {
      team: team.id
    })
  })

export const deleteAppId = (
  deps: InstallerDeps,
  query: TeamQuery,
  appIdId: string
): Promise<void> =>
  withTeam(deps, query, async (developer, team) => {
    const { appIds } = await developer.appIds(team)
    const appId = appIds.find((candidate) => candidate.id === appIdId)
    if (!appId)
      throw new IPAForgeError(ErrorCode.AppIdUnavailable, {
        message: 'no such App ID on the team',
        data: { appId: appIdId }
      })
    await developer.deleteAppId(team, appId)
    deps.logger.info('App ID deleted from the Developer Portal page', {
      identifier: appId.identifier
    })
  })

export const teamAppGroups = (
  deps: InstallerDeps,
  query: TeamQuery
): Promise<TeamAppGroups> =>
  withTeam(deps, query, async (developer, team) => ({
    team,
    groups: await developer.appGroups(team)
  }))

export const registeredDevices = (
  deps: InstallerDeps,
  query: TeamQuery
): Promise<TeamDevices> =>
  withTeam(deps, query, async (developer, team) => ({
    team,
    devices: await developer.devices(team)
  }))

/** `ABCDE12345.com.example.app` → `com.example.app`; undefined for a wildcard or a missing one. */
const bundleIdOf = (applicationIdentifier: string | undefined) => {
  if (!applicationIdentifier || applicationIdentifier.includes('*')) return
  const dot = applicationIdentifier.indexOf('.')

  return dot < 0 ? undefined : applicationIdentifier.slice(dot + 1)
}

/** The provisioning profiles on the device, each with whether an installed app (or one of its extensions) uses it. */
export const deviceProfiles = async (
  deps: InstallerDeps,
  udid: string
): Promise<DeviceProfileInfo[]> => {
  const handle = await deps.devices.open(udid, { autoPair: false })
  try {
    const installed = (await handle.listApps('User')).map((app) => app.bundleId)
    const isUsed = (bundleId: string | undefined) =>
      bundleId !== undefined &&
      installed.some(
        (app) => bundleId === app || bundleId.startsWith(`${app}.`)
      )

    return (await handle.listProfiles()).map((profile) => {
      const bundleId = bundleIdOf(profile.applicationIdentifier)

      return compact({
        uuid: profile.uuid,
        name: profile.name,
        teamId: profile.teamId,
        bundleId,
        expiresAt: profile.expirationDate,
        isUsed: isUsed(bundleId)
      })
    })
  } finally {
    await handle.close()
  }
}

export const removeDeviceProfiles = async (
  deps: InstallerDeps,
  udid: string,
  uuids: readonly string[]
): Promise<void> => {
  const handle = await deps.devices.open(udid, { autoPair: false })
  try {
    for (const uuid of uuids) await handle.removeProfile(uuid)
    deps.logger.info('profiles removed from the Developer Portal page', {
      count: uuids.length
    })
  } finally {
    await handle.close()
  }
}
