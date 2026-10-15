// Reads the IPA before any Apple call, so a broken or encrypted app fails without using up App IDs.
import type { FlowRuntime } from "@installer/application/runtime.ts";
import { StepLabel } from "@installer/domain/labels.ts";
import type { InstallState } from "@installer/domain/state.ts";
import { StepWeight } from "@installer/domain/step-weights.ts";
import type { Step } from "@installer/pipeline/step.ts";
import { appStepId, jobAt, required, updateJob } from "@installer/steps/app-job.ts";

export const inspectStep = (runtime: FlowRuntime, index: number): Step<InstallState> => ({
  id: appStepId("inspect", index),
  labelKey: StepLabel.inspect,
  weight: StepWeight.inspect,
  idempotent: true,
  run: async (state, context) => {
    const file = required(jobAt(state, index).file, "IPA file");
    return updateJob(state, index, { inspection: await runtime.deps.signer.inspect(file, context.signal) });
  },
});
