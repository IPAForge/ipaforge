// Gives the app just installed this computer's pairing file, at the paths its pairing-app entry lists (for
// LiveContainer, inside the SideStore it hosts).
import type { FlowRuntime } from "@installer/application/runtime.ts";
import { StepLabel } from "@installer/domain/labels.ts";
import type { InstallState } from "@installer/domain/state.ts";
import { StepWeight } from "@installer/domain/step-weights.ts";
import type { Step } from "@installer/pipeline/step.ts";
import { jobAt, required } from "@installer/steps/app-job.ts";
import { type AppFileTarget, PAIRING_APPS } from "@loadstar/device";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

const pairingTargetsFor = (appId: string, bundleId: string): AppFileTarget[] => {
  const app = PAIRING_APPS.find((candidate) => candidate.id === appId);
  if (!app) throw new LoadstarError(ErrorCode.Unexpected, { message: `unknown pairing app ${appId}` });
  return app.files.map((path) => ({ bundleId, path }));
};

export const installedPairingStep = (runtime: FlowRuntime): Step<InstallState> => ({
  id: "pairing",
  labelKey: StepLabel.pairing,
  weight: StepWeight.pairing,
  skip: (state) => state.pairingApp === undefined,
  run: async (state) => {
    const bundleId = required(jobAt(state, 0).identity, "identity plan").newMainBundleId;
    const targets = pairingTargetsFor(required(state.pairingApp, "pairing app"), bundleId);
    const handle = await runtime.device(state.udid);
    return { pairingPlaced: await handle.placePairingFile(targets) };
  },
});
