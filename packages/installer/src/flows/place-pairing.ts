// placePairing: puts this computer's pairing file into the pairing apps on the device (SideStore, LiveContainer,
// StikDebug, …) that the user picks. Sideloaded copies count only when one of the account's teams signed them.
import { ask } from "@installer/application/ask.ts";
import type { FlowRuntime } from "@installer/application/runtime.ts";
import { StepLabel } from "@installer/domain/labels.ts";
import { type PairingAppChoice, PromptKind } from "@installer/domain/prompts.ts";
import type { AccountState } from "@installer/domain/state.ts";
import { StepWeight } from "@installer/domain/step-weights.ts";
import type { Flow } from "@installer/flows/flow.ts";
import { pipeline } from "@installer/pipeline/pipeline.ts";
import type { Step, StepContext } from "@installer/pipeline/step.ts";
import { required } from "@installer/steps/app-job.ts";
import { devicePreflightStep } from "@installer/steps/device-preflight.ts";
import { signInStep } from "@installer/steps/sign-in.ts";
import type { AppFileTarget, DeviceHandle, PairingTarget } from "@loadstar/device";
import { compact } from "@loadstar/kernel";

/** `replace` rewrites every file; `keep-existing` only writes the files an app does not have yet. */
export type PairingOverwrite = "replace" | "keep-existing";

export interface PlacePairingInput {
  readonly udid: string;
  readonly accountId: string;
  /** Apps to place it into; without them the user picks. */
  readonly bundleIds?: readonly string[];
  readonly overwrite?: PairingOverwrite;
}

export interface PairingState extends AccountState {
  readonly bundleIds?: readonly string[];
  readonly overwrite: PairingOverwrite;
  readonly targets?: readonly AppFileTarget[];
  readonly placed?: readonly AppFileTarget[];
}

export const PLACE_PAIRING = "placePairing";

const appChoices = (targets: readonly PairingTarget[]): PairingAppChoice[] => [
  ...new Map(
    targets.map((target) => [target.bundleId, { bundleId: target.bundleId, appName: target.appName }]),
  ).values(),
];

const chosenBundleIds = async (state: PairingState, context: StepContext, targets: readonly PairingTarget[]) =>
  state.bundleIds ?? (await ask(context, PromptKind.ChoosePairingApps, { apps: appChoices(targets) }));

const withoutExisting = async (handle: DeviceHandle, targets: readonly AppFileTarget[]) =>
  (await handle.appFileStatus(targets)).filter((status) => !status.exists).map((status) => status.target);

const targetsStep = (runtime: FlowRuntime): Step<PairingState> => ({
  id: "targets",
  labelKey: StepLabel.pairingTargets,
  weight: StepWeight.check,
  run: async (state, context) => {
    const teams = await (await runtime.developer(state.accountId)).teams();
    const handle = await runtime.device(state.udid);
    const found = await handle.pairingTargets(teams.map((team) => team.id));
    if (found.length === 0) return { targets: [] };
    const chosen = new Set(await chosenBundleIds(state, context, found));
    const targets = found.filter((target) => chosen.has(target.bundleId));
    return { targets: state.overwrite === "replace" ? targets : await withoutExisting(handle, targets) };
  },
});

const placeStep = (runtime: FlowRuntime): Step<PairingState> => ({
  id: "place",
  labelKey: StepLabel.placePairing,
  weight: StepWeight.pairing,
  run: async (state) => {
    const targets = required(state.targets, "pairing targets");
    if (targets.length === 0) return { placed: [] };
    return { placed: await (await runtime.device(state.udid)).placePairingFile(targets) };
  },
});

export const placePairingFlow = (runtime: FlowRuntime, input: PlacePairingInput): Flow<PairingState> => ({
  initial: compact({
    udid: input.udid,
    accountId: input.accountId,
    bundleIds: input.bundleIds,
    overwrite: input.overwrite ?? "replace",
  }),
  pipeline: pipeline<PairingState>(PLACE_PAIRING, [
    devicePreflightStep(runtime),
    signInStep(runtime),
    targetsStep(runtime),
    placeStep(runtime),
  ]),
});
