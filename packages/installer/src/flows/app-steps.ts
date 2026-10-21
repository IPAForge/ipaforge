// Step groups the install flows share: getting and checking each app, the Apple account work done once per run,
// and putting each app on the device.
import type { FlowRuntime } from '@installer/application/runtime.ts'
import type { AppSource, InstallState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'
import { downloadStep, resolveReleaseStep } from '@installer/steps/acquire.ts'
import { appIdsStep } from '@installer/steps/app-ids.ts'
import { certificateStep } from '@installer/steps/certificate.ts'
import { certificateSharingStep } from '@installer/steps/certificate-sharing.ts'
import { freeAppsStep } from '@installer/steps/free-apps.ts'
import { inspectStep } from '@installer/steps/inspect.ts'
import { installStep } from '@installer/steps/install.ts'
import { provisionStep } from '@installer/steps/provision.ts'
import { registerDeviceStep } from '@installer/steps/register-device.ts'
import { saveSignedStep } from '@installer/steps/save.ts'
import { signStep } from '@installer/steps/sign.ts'
import { signInStep } from '@installer/steps/sign-in.ts'
import { teamStep } from '@installer/steps/team.ts'

/**
 * Catalog apps are resolved and downloaded; a user's file asks before it may receive the certificate. An app
 * refreshed from its kept IPA keeps the trust it had, so it's only checked again.
 */
export const prepareAppSteps = (
  runtime: FlowRuntime,
  source: AppSource,
  index: number
): Step<InstallState>[] => {
  if (source.kind === 'catalog')
    return [
      resolveReleaseStep(runtime, index),
      downloadStep(runtime, index),
      inspectStep(runtime, index)
    ]
  if (source.kind === 'installed') return [inspectStep(runtime, index)]

  return [inspectStep(runtime, index), certificateSharingStep(runtime, index)]
}

/** Sign in, pick the team, register the device, get the certificate and check the App ID budget. */
export const accountSteps = (runtime: FlowRuntime): Step<InstallState>[] => [
  signInStep(runtime),
  teamStep(runtime),
  registerDeviceStep(runtime),
  certificateStep(runtime),
  appIdsStep(runtime)
]

/**
 * Save signed .ipa instead: provisioned and signed like an install (no private key inside), then written to the
 * folder the user picked. It takes no free-app slot: nothing goes on the device.
 */
export const saveAppSteps = (
  runtime: FlowRuntime,
  index: number,
  folder: string
): Step<InstallState>[] => [
  provisionStep(runtime, index),
  signStep(runtime, index, { forSaving: true }),
  saveSignedStep(runtime, index, folder)
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
