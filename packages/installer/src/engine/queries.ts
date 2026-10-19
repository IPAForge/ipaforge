// Read-only questions the UI asks between runs. They never prompt: an account that needs signing in again fails
// with `apple.session_expired`, an open team choice with `installer.team_required`.
import { listInstalledApps } from '@installer/application/installed/list-installed.ts'
import { planRefresh } from '@installer/application/installed/refresh-plan.ts'
import { removeInstalledApp } from '@installer/application/installed/remove-app.ts'
import { createFlowRuntime } from '@installer/application/runtime.ts'
import { queryTeam } from '@installer/application/team.ts'
import { planInstall } from '@installer/engine/plan.ts'
import type { EngineQueries, TeamQuery } from '@installer/engine/types.ts'
import type { InstallerDeps } from '@installer/types.ts'
import type { DeveloperServices, Team } from '@ipaforge/apple'
import type { DeviceCheck } from '@ipaforge/device'

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
  canSaveAccounts: async () => (await deps.secrets.isPersistent?.()) ?? true,
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
  planInstall: (input) => planInstall(deps, input),
  listSources: () => deps.catalog.sources.list(),
  sourceApps: () => deps.catalog.sources.apps(),
  checkSource: (url) => deps.catalog.sources.check(url),
  addSource: (url) => deps.catalog.sources.add(url),
  removeSource: (id) => deps.catalog.sources.remove(id),
  setSourceEnabled: (id, enabled) =>
    deps.catalog.sources.setEnabled(id, enabled),
  refreshSources: (id) => deps.catalog.sources.refresh(id),
  installedApps: ({ udid, teamIds }) => listInstalledApps(deps, udid, teamIds),
  removeApp: ({ udid, bundleId }) => removeInstalledApp(deps, udid, bundleId),
  refreshPlan: (query) => planRefresh(deps, query)
})
