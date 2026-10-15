// Installs the signed app with progress. Two installd answers get special handling: a banned profile marks the
// account as banned on this device (so the UI can offer another Apple ID), and a free-app-limit refusal (iOS
// counted an app the profile check could not see) asks which listed app to remove, then installs once more. The
// signed IPA is deleted when the step ends, success or not; a resumed run signs again.
import { chooseAppToRemove, removeFreeApp } from "@installer/application/free-apps.ts";
import type { FlowRuntime } from "@installer/application/runtime.ts";
import { StepLabel } from "@installer/domain/labels.ts";
import type { InstallState, SignedIpa } from "@installer/domain/state.ts";
import { StepWeight } from "@installer/domain/step-weights.ts";
import type { Step, StepContext } from "@installer/pipeline/step.ts";
import { appStepId, jobAt, required, updateJob } from "@installer/steps/app-job.ts";
import { signToScratch } from "@installer/steps/sign.ts";
import type { DeviceHandle } from "@loadstar/device";
import { compact, ErrorCode, type FileSource, LoadstarError } from "@loadstar/kernel";

const PERCENT = 100;

const hasCode = (error: unknown, code: ErrorCode): error is LoadstarError =>
  error instanceof LoadstarError && error.code === code;

/** The apps installd says hold the free-profile slots, other than the one being installed. */
const listedFreeApps = (error: LoadstarError, installing: string): { bundleId: string }[] => {
  const listed = error.data?.freeProfileApps;
  if (!Array.isArray(listed)) return [];
  return listed
    .filter((bundleId): bundleId is string => typeof bundleId === "string" && bundleId !== installing)
    .map((bundleId) => ({ bundleId }));
};

const install = (handle: DeviceHandle, file: FileSource, context: StepContext): Promise<void> =>
  handle.installIpa(file, {
    onProgress: ({ percent }) => context.progress(percent / PERCENT),
    signal: context.signal,
  });

/** Frees the slot the user picks from installd's list, then installs again. */
const retryAfterRemoval = async (
  runtime: FlowRuntime,
  handle: DeviceHandle,
  context: StepContext,
  { error, file, installing }: { error: LoadstarError; file: FileSource; installing: string },
): Promise<void> => {
  const apps = listedFreeApps(error, installing);
  if (apps.length === 0) throw error;
  const chosen = await chooseAppToRemove(context, apps, { limit: runtime.deps.config.freeAppLimit, installing });
  const profiles = (await handle.listProfiles()).map((profile) =>
    compact({ uuid: profile.uuid, applicationIdentifier: profile.applicationIdentifier }),
  );
  await removeFreeApp(handle, profiles, chosen);
  await install(handle, file, context);
};

/** The signed IPA from the sign step, or a fresh one when a resumed run finds it deleted. */
const signedIpa = async (
  runtime: FlowRuntime,
  state: InstallState,
  index: number,
  context: StepContext,
): Promise<SignedIpa> => {
  const signed = required(jobAt(state, index).signed, "signed IPA");
  if (await runtime.deps.scratch.has(signed.key)) return signed;
  return signToScratch(runtime, state, index, context);
};

/** Installs, handling a ban and installd's free-app-limit refusal. */
const installSigned = async (
  runtime: FlowRuntime,
  state: InstallState,
  context: StepContext,
  { file, installing }: { file: FileSource; installing: string },
): Promise<void> => {
  const handle = await runtime.device(state.udid);
  try {
    await install(handle, file, context);
  } catch (error) {
    if (hasCode(error, ErrorCode.ProfileBanned)) await runtime.deps.apple.markBanned(state.accountId, state.udid);
    if (!hasCode(error, ErrorCode.FreeAppLimit)) throw error;
    await retryAfterRemoval(runtime, handle, context, { error, file, installing });
  }
};

export const installStep = (runtime: FlowRuntime, index: number): Step<InstallState> => ({
  id: appStepId("install", index),
  labelKey: StepLabel.install,
  weight: StepWeight.install,
  run: async (state, context) => {
    const installing = required(jobAt(state, index).identity, "identity plan").newMainBundleId;
    const signed = await signedIpa(runtime, state, index, context);
    // The signed IPA may hold SideStore's certificate and key: never leave it behind, whatever the outcome.
    try {
      await installSigned(runtime, state, context, { file: signed.file, installing });
    } finally {
      await runtime.deps.scratch.delete(signed.key);
    }
    return updateJob(state, index, { installed: true });
  },
});
