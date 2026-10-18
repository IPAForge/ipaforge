// A read-only preview of installing one app: what the IPA is, whether the device can run it, the identity it would
// get, the App IDs it needs against the budget, the free-app slots on the device and whether a certificate can be
// reused. Nothing is written to Apple or the device (a catalog app is downloaded into the download cache to be
// inspected).
import { createCertificateStore } from '@installer/application/certificate-store.ts'
import { freeSlotsOnDevice } from '@installer/application/free-apps.ts'
import {
  createFlowRuntime,
  type FlowRuntime
} from '@installer/application/runtime.ts'
import { queryTeam } from '@installer/application/team.ts'
import { plannedIdentifiers } from '@installer/domain/app-id-budget.ts'
import type { AppSource } from '@installer/domain/types.ts'
import type {
  CertificateStatus,
  InstallPlan,
  PlanInstallInput
} from '@installer/engine/types.ts'
import { findSideStoreTarget } from '@installer/sidestore/target.ts'
import type { InstallerDeps } from '@installer/types.ts'
import type { DeveloperServices, Team } from '@ipaforge/apple'
import { compact, type FileSource } from '@ipaforge/kernel'
import {
  checkCompatibility,
  planSideloadIdentity,
  type TargetDevice
} from '@ipaforge/signer'

const sourceFile = async (
  deps: InstallerDeps,
  source: AppSource
): Promise<FileSource> => {
  if (source.kind === 'file') return source.file
  const channel =
    source.channel ?? (await deps.catalog.recommendedChannel(source.appId))

  return (
    await deps.catalog.download(
      await deps.catalog.resolve(source.appId, channel)
    )
  ).file
}

const targetDevice = async (
  runtime: FlowRuntime,
  udid: string
): Promise<TargetDevice> => {
  const { info } = await (await runtime.device(udid)).check()

  return { iosVersion: info.productVersion, deviceClass: info.deviceClass }
}

const certificateStatus = async (
  deps: InstallerDeps,
  developer: DeveloperServices,
  input: PlanInstallInput,
  team: Team
): Promise<CertificateStatus> => {
  const stored = await createCertificateStore(deps.secrets, deps.logger).load(
    input.accountId,
    team.id
  )
  const listed = await developer.certificates(team)
  const reusable = listed.some(
    (certificate) =>
      certificate.serialNumber === stored?.certificate.serialNumber
  )

  return { stored: stored !== undefined, reusable, onTeam: listed.length }
}

const freeSlots = async (
  runtime: FlowRuntime,
  input: PlanInstallInput,
  team: Team,
  installing: string
) => {
  if (!team.isFree) return undefined
  const { config } = runtime.deps
  const rules = {
    freeTeamIds: new Set([team.id]),
    maxLifetimeMs: config.freeProfileMaxLifetimeMs
  }
  const { occupied } = await freeSlotsOnDevice(
    await runtime.device(input.udid),
    rules,
    installing
  )

  return { occupied, limit: config.freeAppLimit }
}

/** The version on the device of the app this would install (its sideload bundle ID), if it is there. */
const installedVersion = async (
  runtime: FlowRuntime,
  udid: string,
  bundleId: string
): Promise<string | undefined> => {
  const app = (await (await runtime.device(udid)).lookupApps([bundleId])).get(
    bundleId
  )

  return app?.shortVersion ?? app?.version
}

const buildPlan = async (
  runtime: FlowRuntime,
  input: PlanInstallInput
): Promise<InstallPlan> => {
  const { deps } = runtime
  const file = await sourceFile(deps, input.source)
  const inspection = await deps.signer.inspect(file)
  const compatibility = checkCompatibility(
    inspection,
    await targetDevice(runtime, input.udid)
  )
  const developer = await runtime.developer(input.accountId)
  const team = await queryTeam(deps, developer, {
    accountId: input.accountId,
    requested: input.teamId
  })
  const identity = planSideloadIdentity(inspection, team.id)
  const slots = await freeSlots(runtime, input, team, identity.newMainBundleId)

  return compact({
    team,
    inspection,
    compatibility,
    identity,
    installedVersion: await installedVersion(
      runtime,
      input.udid,
      identity.newMainBundleId
    ),
    appIds: await developer.planAppIds(team, plannedIdentifiers([identity])),
    freeSlots: slots,
    certificate: await certificateStatus(deps, developer, input, team),
    sharesCertificate:
      findSideStoreTarget(await deps.signer.bundles(file)) !== undefined
  })
}

export const planInstall = async (
  deps: InstallerDeps,
  input: PlanInstallInput
): Promise<InstallPlan> => {
  const runtime = createFlowRuntime(deps)
  try {
    return await buildPlan(runtime, input)
  } finally {
    await runtime.close()
  }
}
