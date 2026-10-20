// placePairing: puts this computer's pairing file into the pairing apps on the device (SideStore, LiveContainer,
// StikDebug, …) that the user picks. Sideloaded copies count only when one of the account's teams signed them.
import { ask } from '@installer/application/ask.ts'
import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { PromptKind } from '@installer/domain/prompts.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { PairingAppChoice } from '@installer/domain/types.ts'
import type { Flow } from '@installer/flows/flow.ts'
import type { PairingState, PlacePairingInput } from '@installer/flows/types.ts'
import { pipeline } from '@installer/pipeline/pipeline.ts'
import type { Step, StepContext } from '@installer/pipeline/types.ts'
import { required } from '@installer/steps/app-job.ts'
import { devicePreflightStep } from '@installer/steps/device-preflight.ts'
import { signInStep } from '@installer/steps/sign-in.ts'
import type {
  AppFileTarget,
  DeviceHandle,
  PairingTarget
} from '@ipaforge/device'
import { compact } from '@ipaforge/kernel'

export const PLACE_PAIRING = 'placePairing'

const appChoices = (targets: readonly PairingTarget[]): PairingAppChoice[] => [
  ...new Map(
    targets.map((target) => [
      target.bundleId,
      { bundleId: target.bundleId, appName: target.appName }
    ])
  ).values()
]

const chosenBundleIds = async (
  state: PairingState,
  context: StepContext,
  targets: readonly PairingTarget[]
) =>
  state.bundleIds ??
  (await ask(context, PromptKind.ChoosePairingApps, {
    apps: appChoices(targets)
  }))

/** The targets whose file is not there yet (the statuses come back in the order asked). */
const withoutExisting = async (
  handle: DeviceHandle,
  targets: readonly PairingTarget[]
): Promise<PairingTarget[]> => {
  const statuses = await handle.appFileStatus(targets)

  return targets.filter((_, at) => statuses[at]?.exists !== true)
}

/** Each app the file went into, once, by name. */
const placedApps = (
  targets: readonly PairingTarget[],
  placed: readonly AppFileTarget[]
): string[] => [
  ...new Set(
    targets
      .filter((target) =>
        placed.some(
          (done) =>
            done.bundleId === target.bundleId && done.path === target.path
        )
      )
      .map((target) => target.appName)
  )
]

const targetsStep = (runtime: FlowRuntime): Step<PairingState> => ({
  id: 'targets',
  labelKey: StepLabel.pairingTargets,
  weight: StepWeight.check,
  run: async (state, context) => {
    const teams = await (await runtime.developer(state.accountId)).teams()
    const handle = await runtime.device(state.udid)
    const found = await handle.pairingTargets(teams.map((team) => team.id))
    if (found.length === 0) return { targets: [] }
    const chosen = new Set(await chosenBundleIds(state, context, found))
    const targets = found.filter((target) => chosen.has(target.bundleId))

    return {
      targets:
        state.overwrite === 'replace'
          ? targets
          : await withoutExisting(handle, targets)
    }
  }
})

const placeStep = (runtime: FlowRuntime): Step<PairingState> => ({
  id: 'place',
  labelKey: StepLabel.placePairing,
  weight: StepWeight.pairing,
  run: async (state, context) => {
    const targets = required(state.targets, 'pairing targets')
    if (targets.length === 0) {
      context.detail({ kind: 'pairing', apps: [] })
      return { placed: [] }
    }
    const { classic, remote } = await (
      await runtime.device(state.udid)
    ).placePairingFile(targets)
    context.detail(
      remote.length > 0
        ? { kind: 'pairing', apps: placedApps(targets, classic), remote: true }
        : { kind: 'pairing', apps: placedApps(targets, classic) }
    )

    return { placed: [...classic, ...remote] }
  }
})

export const placePairingFlow = (
  runtime: FlowRuntime,
  input: PlacePairingInput
): Flow<PairingState> => ({
  initial: compact({
    udid: input.udid,
    accountId: input.accountId,
    bundleIds: input.bundleIds,
    overwrite: input.overwrite ?? 'replace'
  }),
  pipeline: pipeline<PairingState>(PLACE_PAIRING, [
    devicePreflightStep(runtime),
    signInStep(runtime),
    targetsStep(runtime),
    placeStep(runtime)
  ])
})
