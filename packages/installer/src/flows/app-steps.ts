// Step groups the install flows share: getting and checking each app, the Apple account work done once per run,
// and putting each app on the device.
import type { FlowRuntime } from '@installer/application/runtime.ts'
import type { AppSource, InstallState } from '@installer/domain/state.ts'
import type { Step } from '@installer/pipeline/step.ts'
import { downloadStep, resolveReleaseStep } from '@installer/steps/acquire.ts'
import { appIdsStep } from '@installer/steps/app-ids.ts'
import { certificateStep } from '@installer/steps/certificate.ts'
import { certificateSharingStep } from '@installer/steps/certificate-sharing.ts'
import { freeAppsStep } from '@installer/steps/free-apps.ts'
import { inspectStep } from '@installer/steps/inspect.ts'
import { installStep } from '@installer/steps/install.ts'
import { provisionStep } from '@installer/steps/provision.ts'
import { registerDeviceStep } from '@installer/steps/register-device.ts'
import { signStep } from '@installer/steps/sign.ts'
import { signInStep } from '@installer/steps/sign-in.ts'
import { teamStep } from '@installer/steps/team.ts'

/** Catalog apps are resolved and downloaded; a user's file asks before it may receive the certificate. */
export const prepareAppSteps = (
  runtime: FlowRuntime,
  source: AppSource,
  index: number
): Step<InstallState>[] =>
  source.kind === 'catalog'
    ? [
        resolveReleaseStep(runtime, index),
        downloadStep(runtime, index),
        inspectStep(runtime, index)
      ]
    : [inspectStep(runtime, index), certificateSharingStep(runtime, index)]

/** Sign in, pick the team, register the device, get the certificate and check the App ID budget. */
export const accountSteps = (runtime: FlowRuntime): Step<InstallState>[] => [
  signInStep(runtime),
  teamStep(runtime),
  registerDeviceStep(runtime),
  certificateStep(runtime),
  appIdsStep(runtime)
]

export const installAppSteps = (
  runtime: FlowRuntime,
  index: number
): Step<InstallState>[] => [
  freeAppsStep(runtime, index),
  provisionStep(runtime, index),
  signStep(runtime, index),
  installStep(runtime, index)
]
