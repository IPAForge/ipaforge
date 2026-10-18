// installSideStore: SideStore (or LiveContainer with SideStore inside) from the catalog, signed with the team's
// certificate shared into it, installed, and given this computer's pairing file.
import type { FlowRuntime } from '@installer/application/runtime.ts'
import type { AppSource, InstallState } from '@installer/domain/types.ts'
import {
  accountSteps,
  installAppSteps,
  prepareAppSteps
} from '@installer/flows/app-steps.ts'
import type { Flow } from '@installer/flows/flow.ts'
import type {
  InstallSideStoreInput,
  SideStoreVariant
} from '@installer/flows/types.ts'
import { pipeline } from '@installer/pipeline/pipeline.ts'
import { devicePreflightStep } from '@installer/steps/device-preflight.ts'
import { installedPairingStep } from '@installer/steps/installed-pairing.ts'
import { rememberTeamStep } from '@installer/steps/remember-team.ts'
import { compact } from '@ipaforge/kernel'

/** Catalog app and pairing-app entry for each variant. */
const VARIANTS: Readonly<
  Record<
    SideStoreVariant,
    { readonly appId: string; readonly pairingApp: string }
  >
> = {
  sidestore: { appId: 'sidestore', pairingApp: 'sidestore' },
  livecontainer: {
    appId: 'livecontainer-sidestore',
    pairingApp: 'livecontainer'
  }
}

export const INSTALL_SIDESTORE = 'installSideStore'

const initialState = (
  input: InstallSideStoreInput,
  source: AppSource
): InstallState =>
  compact({
    udid: input.udid,
    accountId: input.accountId,
    teamId: input.teamId,
    apps: [{ source }],
    pairingApp: VARIANTS[input.variant].pairingApp
  })

export const installSideStoreFlow = (
  runtime: FlowRuntime,
  input: InstallSideStoreInput
): Flow<InstallState> => {
  const source: AppSource = compact({
    kind: 'catalog' as const,
    appId: VARIANTS[input.variant].appId,
    channel: input.channel
  })

  return {
    initial: initialState(input, source),
    pipeline: pipeline<InstallState>(INSTALL_SIDESTORE, [
      devicePreflightStep(runtime),
      ...prepareAppSteps(runtime, source, 0),
      ...accountSteps(runtime),
      ...installAppSteps(runtime, 0),
      installedPairingStep(runtime),
      rememberTeamStep(runtime)
    ])
  }
}
