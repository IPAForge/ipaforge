import type { RunTarget } from '@ui/features/install/run/types.ts'
import type { ActiveRun, RunFailure } from '@ui/state/active-run/types.ts'

/** What failed and on what, never a secret; for a bug report, so it stays in English. */
export const diagnosticsText = (
  appVersion: string,
  run: ActiveRun,
  failure: RunFailure,
  target: RunTarget
) =>
  [
    'Loadstar diagnostics',
    `version: ${appVersion}`,
    `code: ${failure.error.code}`,
    `step: ${failure.stepId || 'unknown'}`,
    `install: ${run.input.variant} (${run.input.channel ?? 'stable'})`,
    `device: ${target.check?.info.productType ?? 'unknown'}, iOS ${target.check?.info.productVersion ?? 'unknown'}`
  ].join('\n')
