// repairSideStore (Repair SideStore): one run with only the fixes the check called for. Installed again (as
// installSideStore does, certificate and pairing file included) when its certificate was revoked, it has none of
// its own, or it's out of date; else a new profile when it expired or is about to, and this computer's pairing file
// when it's missing or another computer's.
import type { FlowRuntime } from '@installer/application/runtime.ts'
import type { InstallState } from '@installer/domain/types.ts'
import type { Flow } from '@installer/flows/flow.ts'
import { sideStoreFlow } from '@installer/flows/install-sidestore.ts'
import { pipeline } from '@installer/pipeline/pipeline.ts'
import { devicePreflightStep } from '@installer/steps/device-preflight.ts'
import { refreshProfilesStep } from '@installer/steps/refresh-profiles.ts'
import { registerDeviceStep } from '@installer/steps/register-device.ts'
import { sideStorePairingStep } from '@installer/steps/sidestore-pairing.ts'
import { signInStep } from '@installer/steps/sign-in.ts'
import { teamStep } from '@installer/steps/team.ts'
import type { Channel } from '@ipaforge/catalog'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export type RepairSideStoreInput = {
  readonly udid: string
  readonly accountId: string
  readonly teamId?: string
  readonly channel?: Channel
  /** SideStore as installed (`com.SideStore.SideStore.<TEAMID>`). */
  readonly bundleId: string
  /** Install it again from the catalog; covers the other fixes. */
  readonly reinstall: boolean
  /** A new profile only (it expired, or is about to). */
  readonly profile: boolean
  /** Place this computer's pairing file. */
  readonly pairing: boolean
}

export const REPAIR_SIDESTORE = 'repairSideStore'

export const repairSideStoreFlow = (
  runtime: FlowRuntime,
  input: RepairSideStoreInput
): Flow<InstallState> => {
  if (input.reinstall)
    return sideStoreFlow(
      runtime,
      compact({
        udid: input.udid,
        accountId: input.accountId,
        teamId: input.teamId,
        channel: input.channel,
        variant: 'sidestore' as const
      }),
      REPAIR_SIDESTORE
    )
  if (!(input.profile || input.pairing))
    throw new IPAForgeError(ErrorCode.Unexpected, {
      message: 'repairSideStore has nothing to do'
    })

  return {
    initial: compact({
      udid: input.udid,
      accountId: input.accountId,
      teamId: input.teamId,
      apps: []
    }),
    pipeline: pipeline<InstallState>(REPAIR_SIDESTORE, [
      devicePreflightStep(runtime),
      ...(input.profile
        ? [
            signInStep(runtime),
            teamStep(runtime),
            registerDeviceStep(runtime),
            refreshProfilesStep(runtime, input.bundleId, 0)
          ]
        : []),
      ...(input.pairing ? [sideStorePairingStep(runtime, input.bundleId)] : [])
    ])
  }
}
