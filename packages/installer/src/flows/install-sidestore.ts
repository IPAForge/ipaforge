// installSideStore: SideStore (or LiveContainer with SideStore inside) from the catalog, signed with the team's
// certificate shared into it, installed, and given this computer's pairing file.
import type { FlowRuntime } from '@installer/application/runtime.ts'
import type { AppSource, InstallState } from '@installer/domain/state.ts'
import {
  accountSteps,
  installAppSteps,
  prepareAppSteps
} from '@installer/flows/app-steps.ts'
import type { Flow } from '@installer/flows/flow.ts'
import { pipeline } from '@installer/pipeline/pipeline.ts'
import { devicePreflightStep } from '@installer/steps/device-preflight.ts'
import { installedPairingStep } from '@installer/steps/installed-pairing.ts'
import { rememberTeamStep } from '@installer/steps/remember-team.ts'
import type { Channel } from '@loadstar/catalog'
import { compact } from '@loadstar/kernel'

export type SideStoreVariant = 'sidestore' | 'livecontainer'

export type InstallSideStoreInput = {
  readonly udid: string
  /** A saved Apple account (`SavedAccount.id`). */
  readonly accountId: string
  readonly teamId?: string
  /** Default: the channel the catalog recommends for the device's iOS version. */
  readonly channel?: Channel
  readonly variant: SideStoreVariant
}

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
