// Read-only questions the UI asks between runs. They never prompt: an account that needs signing in again fails
// with `apple.session_expired`, an open team choice with `installer.team_required`.
import { createFlowRuntime } from '@installer/application/runtime.ts'
import { queryTeam } from '@installer/application/team.ts'
import type { InstallerDeps } from '@installer/deps.ts'
import {
  type InstallPlan,
  type PlanInstallInput,
  planInstall
} from '@installer/engine/plan.ts'
import type {
  AppId,
  AppIdQuota,
  DeveloperServices,
  DevelopmentCertificate,
  SavedAccount,
  Team
} from '@loadstar/apple'
import type { CatalogApp, Channel } from '@loadstar/catalog'
import type { DeviceCheck, UsbmuxDevice } from '@loadstar/device'

export type TeamQuery = {
  readonly accountId: string
  /** Default: the team remembered for the account, or its only team. */
  readonly teamId?: string
}

export type AppIdUsage = {
  readonly team: Team
  readonly appIds: readonly AppId[]
  readonly quota: AppIdQuota
}

export type TeamCertificates = {
  readonly team: Team
  readonly certificates: readonly DevelopmentCertificate[]
}

export type EngineQueries = {
  listDevices(): Promise<UsbmuxDevice[]>
  /** Lock state, Developer Mode and iOS version of a paired device. */
  deviceStatus(udid: string): Promise<DeviceCheck>
  /**
   * Pairs with the device when it doesn't trust this computer yet (the Trust prompt shows on the device and this
   * waits for the tap), then reads its status like `deviceStatus`.
   */
  pairDevice(udid: string): Promise<DeviceCheck>
  listAccounts(): Promise<SavedAccount[]>
  listTeams(accountId: string): Promise<Team[]>
  catalogApps(): Promise<readonly CatalogApp[]>
  recommendedChannel(appId: string, iosVersion?: string): Promise<Channel>
  appIdQuota(query: TeamQuery): Promise<AppIdUsage>
  listCertificates(query: TeamQuery): Promise<TeamCertificates>
  /** Read-only preview of installing one app (identity, App ID budget, free-app slots, certificate). */
  planInstall(input: PlanInstallInput): Promise<InstallPlan>
}

/** Runs `use` with the account's developer services and the queried team. */
const withTeam = async <T>(
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

const deviceStatus = async (
  deps: InstallerDeps,
  udid: string,
  autoPair: boolean
): Promise<DeviceCheck> => {
  const handle = await deps.devices.open(udid, { autoPair })
  try {
    return await handle.check()
  } finally {
    await handle.close()
  }
}

export const createEngineQueries = (deps: InstallerDeps): EngineQueries => ({
  listDevices: () => deps.devices.listDevices(),
  deviceStatus: (udid) => deviceStatus(deps, udid, false),
  pairDevice: (udid) => deviceStatus(deps, udid, true),
  listAccounts: () => deps.apple.accounts.list(),
  listTeams: async (accountId) =>
    (await createFlowRuntime(deps).developer(accountId)).teams(),
  catalogApps: async () => (await deps.catalog.manifest()).apps,
  recommendedChannel: (appId, iosVersion) =>
    deps.catalog.recommendedChannel(appId, iosVersion),
  appIdQuota: (query) =>
    withTeam(deps, query, async (developer, team) => ({
      team,
      ...(await developer.appIds(team))
    })),
  listCertificates: (query) =>
    withTeam(deps, query, async (developer, team) => ({
      team,
      certificates: await developer.certificates(team)
    })),
  planInstall: (input) => planInstall(deps, input)
})
