// refreshApps (the Apps page's Refresh): apps whose certificate is still valid get new profiles only, the way
// SideStore refreshes (fast, nothing reinstalled); the others are signed and installed again from where they came
// from (the kept IPA, the catalog or a source link), as installApps does. One run, the account steps once.
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
import { refreshProfilesStep } from '@installer/steps/refresh-profiles.ts'
import { registerDeviceStep } from '@installer/steps/register-device.ts'
import { rememberTeamStep } from '@installer/steps/remember-team.ts'
import { signInStep } from '@installer/steps/sign-in.ts'
import { teamStep } from '@installer/steps/team.ts'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export type RefreshAppsInput = {
  readonly udid: string
  readonly accountId: string
  readonly teamId?: string
  /** Apps (installed bundle ids) that only need new profiles. */
  readonly profiles: readonly string[]
  /** Apps to sign and install again. */
  readonly apps: readonly AppSource[]
  /** Create App IDs even though Apple's count says none are left, when that count was negative (Try anyway). */
  readonly tryAnyway?: boolean
}

export const REFRESH_APPS = 'refreshApps'

const jobFor = (source: AppSource): AppJob => {
  if (source.kind === 'catalog') return { source }
  if (source.kind === 'file') return { source, file: source.file }

  return compact({ source, file: source.file, trust: source.record.trust })
}

const catalogIdOf = (source: AppSource): string | undefined => {
  if (source.kind === 'catalog') return source.appId
  if (source.kind === 'installed' && source.record.origin.kind === 'catalog')
    return source.record.origin.appId

  return undefined
}

/** The apps installed again that get the pairing file (SideStore, LiveContainer + SideStore), by position. */
const pairingTargets = (apps: readonly AppSource[]) =>
  apps.flatMap((source, index) => {
    const appId = catalogIdOf(source)
    const pairingApp = appId ? CATALOG_PAIRING_APPS[appId] : undefined

    return pairingApp ? [{ index, pairingApp }] : []
  })

export const refreshAppsFlow = (
  runtime: FlowRuntime,
  input: RefreshAppsInput
): Flow<InstallState> => {
  if (input.profiles.length + input.apps.length === 0)
    throw new IPAForgeError(ErrorCode.Unexpected, {
      message: 'refreshApps needs at least one app'
    })

  // New profiles alone need no certificate or App ID check: only apps signed again do.
  const account =
    input.apps.length > 0
      ? accountSteps(runtime)
      : [signInStep(runtime), teamStep(runtime), registerDeviceStep(runtime)]
  // The apps signed again come first (their steps are numbered from 0), then the ones getting new profiles.
  const first = input.apps.length

  return {
    initial: compact({
      udid: input.udid,
      accountId: input.accountId,
      teamId: input.teamId,
      tryAnyway: input.tryAnyway,
      apps: input.apps.map(jobFor)
    }),
    pipeline: pipeline<InstallState>(REFRESH_APPS, [
      devicePreflightStep(runtime),
      ...input.apps.flatMap((source, index) =>
        prepareAppSteps(runtime, source, index)
      ),
      ...account,
      ...input.apps.flatMap((_source, index) =>
        installAppSteps(runtime, index)
      ),
      ...input.profiles.map((bundleId, index) =>
        refreshProfilesStep(runtime, bundleId, first + index)
      ),
      ...pairingTargets(input.apps).map((target) =>
        installedPairingStep(runtime, target)
      ),
      rememberTeamStep(runtime)
    ])
  }
}
