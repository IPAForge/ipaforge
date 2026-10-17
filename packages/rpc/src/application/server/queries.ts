// Answers a query by calling the Engine method it names.
import type { Engine } from '@loadstar/installer'
import { compact } from '@loadstar/kernel'
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
  pairDevice: ([udid]) => engine.pairDevice(udid),
  listAccounts: () => engine.listAccounts(),
  signOut: ([accountId]) => engine.signOut(accountId),
  listTeams: ([accountId]) => engine.listTeams(accountId),
  catalogApps: () => engine.catalogApps(),
  recommendedChannel: ([appId, iosVersion]) =>
    engine.recommendedChannel(appId, iosVersion),
  appIdQuota: ([query]) => engine.appIdQuota(compact(query)),
  listCertificates: ([query]) => engine.listCertificates(compact(query)),
  planInstall: async ([input], signal) =>
    engine.planInstall(await toPlanInstallInput(input, resolveIpa, signal))
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
