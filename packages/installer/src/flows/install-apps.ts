// installApps (preload): one or more IPAs, from the catalog or the user's files, checked first, then provisioned,
// signed and installed one after another with the same account, team and certificate.
import type { FlowRuntime } from '@installer/application/runtime.ts'
import type {
  AppJob,
  AppSource,
  InstallState
} from '@installer/domain/state.ts'
import {
  accountSteps,
  installAppSteps,
  prepareAppSteps
} from '@installer/flows/app-steps.ts'
import type { Flow } from '@installer/flows/flow.ts'
import { pipeline } from '@installer/pipeline/pipeline.ts'
import { devicePreflightStep } from '@installer/steps/device-preflight.ts'
import { rememberTeamStep } from '@installer/steps/remember-team.ts'
import { compact, ErrorCode, LoadstarError } from '@loadstar/kernel'

export type InstallAppsInput = {
  readonly udid: string
  readonly accountId: string
  readonly teamId?: string
  readonly apps: readonly AppSource[]
}

export const INSTALL_APPS = 'installApps'

/** A user's file is ready to inspect; a catalog app is downloaded first. */
const jobFor = (source: AppSource): AppJob =>
  source.kind === 'file' ? { source, file: source.file } : { source }

const assertSomethingToInstall = (input: InstallAppsInput): void => {
  if (input.apps.length > 0) return
  throw new LoadstarError(ErrorCode.Unexpected, {
    message: 'installApps needs at least one app'
  })
}

export const installAppsFlow = (
  runtime: FlowRuntime,
  input: InstallAppsInput
): Flow<InstallState> => {
  assertSomethingToInstall(input)
  return {
    initial: compact({
      udid: input.udid,
      accountId: input.accountId,
      teamId: input.teamId,
      apps: input.apps.map(jobFor)
    }),
    pipeline: pipeline<InstallState>(INSTALL_APPS, [
      devicePreflightStep(runtime),
      ...input.apps.flatMap((source, index) =>
        prepareAppSteps(runtime, source, index)
      ),
      ...accountSteps(runtime),
      ...input.apps.flatMap((_source, index) =>
        installAppSteps(runtime, index)
      ),
      rememberTeamStep(runtime)
    ])
  }
}
