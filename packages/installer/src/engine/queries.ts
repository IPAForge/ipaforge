// Read-only questions the UI asks between runs. They never prompt: an account that needs signing in again fails
// with `apple.session_expired`, an open team choice with `installer.team_required`.
import { catalogReleases } from '@installer/application/catalog-releases.ts'
import {
  exportCertificate,
  importCertificate
} from '@installer/application/certificate-transfer.ts'
import {
  deviceApps,
  revealDeveloperMode
} from '@installer/application/device-apps.ts'
import { checkSideStore } from '@installer/application/installed/check-sidestore.ts'
import { listInstalledApps } from '@installer/application/installed/list-installed.ts'
import { planRefresh } from '@installer/application/installed/refresh-plan.ts'
import { removeInstalledApp } from '@installer/application/installed/remove-app.ts'
import {
  devicePairingFile,
  newRemotePairing,
  pairingFiles,
  placeAppPairing,
  removeAppPairing
} from '@installer/application/pairing/pairing-files.ts'
import {
  deleteAppId,
  deviceProfiles,
  registeredDevices,
  removeDeviceProfiles,
  revokeCertificate,
  storedSerial,
  teamAppGroups,
  withTeam
} from '@installer/application/portal.ts'
import { createFlowRuntime } from '@installer/application/runtime.ts'
import { planInstall } from '@installer/engine/plan.ts'
import type { EngineQueries } from '@installer/engine/types.ts'
import type { InstallerDeps } from '@installer/types.ts'
import type { DeviceCheck } from '@ipaforge/device'
import { compact } from '@ipaforge/kernel'

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
    withTeam(deps, query, async (developer, team) =>
      compact({
        team,
        certificates: await developer.certificates(team),
        storedSerial: await storedSerial(deps, query.accountId, team.id)
      })
    ),
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
  refreshPlan: (query) => planRefresh(deps, query),
  checkSideStore: (query) => checkSideStore(deps, query),
  catalogReleases: (appId) => catalogReleases(deps, appId),
  deviceApps: (udid) => deviceApps(deps, udid),
  revealDeveloperMode: (udid) => revealDeveloperMode(deps, udid),
  anisetteServers: () => deps.apple.anisette.overview(),
  chooseAnisetteServer: (choice) => deps.apple.anisette.choose(choice),
  addAnisetteServer: (input) => deps.apple.anisette.addServer(input),
  updateAnisetteServer: (address, input) =>
    deps.apple.anisette.updateServer(address, input),
  removeAnisetteServer: (address) => deps.apple.anisette.removeServer(address),
  testAnisetteServer: (address) => deps.apple.anisette.test(address),
  updateAnisetteServerList: () => deps.apple.anisette.updateList(),
  revokeCertificate: (query, serialNumber) =>
    revokeCertificate(deps, query, serialNumber),
  deleteAppId: (query, appIdId) => deleteAppId(deps, query, appIdId),
  appGroups: (query) => teamAppGroups(deps, query),
  registeredDevices: (query) => registeredDevices(deps, query),
  deviceProfiles: (udid) => deviceProfiles(deps, udid),
  removeDeviceProfiles: (udid, uuids) =>
    removeDeviceProfiles(deps, udid, uuids),
  pairingFiles: (query) => pairingFiles(deps, query),
  placeAppPairing: (input) => placeAppPairing(deps, input),
  removeAppPairing: (query) => removeAppPairing(deps, query),
  newRemotePairing: (query) => newRemotePairing(deps, query),
  devicePairingFile: (udid) => devicePairingFile(deps, udid),
  exportCertificate: (query, password) =>
    exportCertificate(deps, query, password),
  importCertificate: (query, p12, password) =>
    importCertificate(deps, query, p12, password)
})
