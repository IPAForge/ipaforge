// Answers a query by calling the Engine method it names.
import type { Engine } from '@ipaforge/installer'
import { compact } from '@ipaforge/kernel'
import { toPlanInstallInput } from '@rpc/application/server/inputs.ts'
import type { QueryHandlers, RunQuery } from '@rpc/application/server/types.ts'
import type { ResolveIpa } from '@rpc/domain/ports/resolve-ipa.ts'
import type { QueryCall } from '@rpc/domain/protocol/types.ts'

const queryHandlers = (
  engine: Engine,
  resolveIpa: ResolveIpa
): QueryHandlers => ({
  listDevices: () => engine.listDevices(),
  deviceStatus: ([udid]) => engine.deviceStatus(udid),
  deviceApps: ([udid]) => engine.deviceApps(udid),
  revealDeveloperMode: ([udid]) => engine.revealDeveloperMode(udid),
  pairDevice: ([udid]) => engine.pairDevice(udid),
  listAccounts: () => engine.listAccounts(),
  canSaveAccounts: () => engine.canSaveAccounts(),
  anisetteServers: () => engine.anisetteServers(),
  chooseAnisetteServer: ([choice]) =>
    engine.chooseAnisetteServer(compact(choice)),
  addAnisetteServer: ([input]) => engine.addAnisetteServer(input),
  updateAnisetteServer: ([address, input]) =>
    engine.updateAnisetteServer(address, input),
  removeAnisetteServer: ([address]) => engine.removeAnisetteServer(address),
  testAnisetteServer: ([address]) => engine.testAnisetteServer(address),
  updateAnisetteServerList: () => engine.updateAnisetteServerList(),
  revokeCertificate: ([query, serialNumber]) =>
    engine.revokeCertificate(compact(query), serialNumber),
  deleteAppId: ([query, appIdId]) =>
    engine.deleteAppId(compact(query), appIdId),
  appGroups: ([query]) => engine.appGroups(compact(query)),
  registeredDevices: ([query]) => engine.registeredDevices(compact(query)),
  deviceProfiles: ([udid]) => engine.deviceProfiles(udid),
  removeDeviceProfiles: ([udid, uuids]) =>
    engine.removeDeviceProfiles(udid, uuids),
  pairingFiles: ([query]) => engine.pairingFiles(query),
  placeAppPairing: ([input]) => engine.placeAppPairing(compact(input)),
  removeAppPairing: ([query]) => engine.removeAppPairing(query),
  newRemotePairing: ([query]) => engine.newRemotePairing(query),
  devicePairingFile: ([udid]) => engine.devicePairingFile(udid),
  signOut: ([accountId]) => engine.signOut(accountId),
  listTeams: ([accountId]) => engine.listTeams(accountId),
  catalogApps: () => engine.catalogApps(),
  catalogReleases: ([appId]) => engine.catalogReleases(appId),
  recommendedChannel: ([appId, iosVersion]) =>
    engine.recommendedChannel(appId, iosVersion),
  appIdQuota: ([query]) => engine.appIdQuota(compact(query)),
  listCertificates: ([query]) => engine.listCertificates(compact(query)),
  planInstall: async ([input], signal) =>
    engine.planInstall(
      await toPlanInstallInput(input, { resolveIpa, engine }, signal)
    ),
  listSources: () => engine.listSources(),
  sourceApps: () => engine.sourceApps(),
  checkSource: ([url]) => engine.checkSource(url),
  addSource: ([url]) => engine.addSource(url),
  removeSource: ([id]) => engine.removeSource(id),
  setSourceEnabled: ([id, enabled]) => engine.setSourceEnabled(id, enabled),
  refreshSources: ([id]) => engine.refreshSources(id),
  installedApps: ([query]) => engine.installedApps(query),
  removeApp: ([input]) => engine.removeApp(input),
  refreshPlan: ([query]) => engine.refreshPlan(compact(query)),
  checkSideStore: ([query]) => engine.checkSideStore(compact(query))
})

export const createQueryRunner = (
  engine: Engine,
  resolveIpa: ResolveIpa
): RunQuery => {
  const handlers = queryHandlers(engine, resolveIpa)

  // The union of handlers cannot be called with the union of calls; `method` pairs them up.
  return (call, signal) =>
    (
      handlers[call.method] as (
        args: QueryCall['args'],
        signal: AbortSignal
      ) => Promise<unknown>
    )(call.args, signal)
}
