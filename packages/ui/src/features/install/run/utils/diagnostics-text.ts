import type { DiagnosticsFacts } from '@ui/features/install/run/types.ts'

/**
 * What failed and on what, for a bug report: readable names with the identifiers maintainers search for, never a
 * secret (no Apple ID, device name or serial). In English, since it is read by maintainers.
 */
export const diagnosticsText = ({
  appVersion,
  code,
  step,
  install,
  device
}: DiagnosticsFacts): string =>
  [
    'IPAForge diagnostics',
    `version: ${appVersion}`,
    `code: ${code}`,
    `step: ${step}`,
    `install: ${install}`,
    `device: ${device}`
  ].join('\n')
