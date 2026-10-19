// installApps (preload): one or more IPAs, from the catalog or the user's files, checked first, then provisioned,
// signed and installed one after another with the same account, team and certificate. SideStore from the catalog
// (on its own or in LiveContainer) also gets this computer's pairing file, as installSideStore does.
import type { FlowRuntime } from '@installer/application/runtime.ts'
import type {
  AppJob,
  AppSource,
  InstallState
} from '@installer/domain/types.ts'
import {
  accountSteps,
  installAppSteps,
  prepareAppSteps
} from '@installer/flows/app-steps.ts'
import { CATALOG_PAIRING_APPS } from '@installer/flows/constants.ts'
import type { Flow } from '@installer/flows/flow.ts'
import { pipeline } from '@installer/pipeline/pipeline.ts'
import { devicePreflightStep } from '@installer/steps/device-preflight.ts'
import { installedPairingStep } from '@installer/steps/installed-pairing.ts'
import { rememberTeamStep } from '@installer/steps/remember-team.ts'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export type InstallAppsInput = {
  readonly udid: string
  readonly accountId: string
  readonly teamId?: string
  readonly apps: readonly AppSource[]
}

export const INSTALL_APPS = 'installApps'

/**
 * A user's file is ready to inspect; a catalog app is downloaded first. An app installed before is signed again
 * from its kept IPA, with the certificate trust it had (so the run doesn't ask again).
 */
const jobFor = (source: AppSource): AppJob => {
  if (source.kind === 'catalog') return { source }
  if (source.kind === 'file') return { source, file: source.file }

  return compact({ source, file: source.file, trust: source.record.trust })
}

/** The catalog app a source is, or was first installed from (a refresh of SideStore is still SideStore). */
const catalogIdOf = (source: AppSource): string | undefined => {
  if (source.kind === 'catalog') return source.appId
  if (source.kind === 'installed' && source.record.origin.kind === 'catalog')
    return source.record.origin.appId

  return undefined
}

/** Every catalog app in the list that gets the pairing file (SideStore, LiveContainer + SideStore), by position. */
const pairingTargets = (apps: readonly AppSource[]) =>
  apps.flatMap((source, index) => {
    const appId = catalogIdOf(source)
    const pairingApp = appId ? CATALOG_PAIRING_APPS[appId] : undefined

    return pairingApp ? [{ index, pairingApp }] : []
  })

const assertSomethingToInstall = (input: InstallAppsInput): void => {
  if (input.apps.length > 0) return
  throw new IPAForgeError(ErrorCode.Unexpected, {
    message: 'installApps needs at least one app'
  })
}

export const installAppsFlow = (
  runtime: FlowRuntime,
  input: InstallAppsInput
): Flow<InstallState> => {
  assertSomethingToInstall(input)
  const pairing = pairingTargets(input.apps)

  return {
    initial: compact({
      udid: input.udid,
      accountId: input.accountId,
      teamId: input.teamId,
      apps: input.apps.map(jobFor)
    }),
    pipeline: pipeline<InstallState>(INSTALL_APPS, [
      devicePreflightStep(runtime),
      ...input.apps.flatMap((source, index) =>
        prepareAppSteps(runtime, source, index)
      ),
      ...accountSteps(runtime),
      ...input.apps.flatMap((_source, index) =>
        installAppSteps(runtime, index)
      ),
      ...pairing.map((target) => installedPairingStep(runtime, target)),
      rememberTeamStep(runtime)
    ])
  }
}
