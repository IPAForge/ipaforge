import { DEFAULT_INSTALLER_CONFIG } from '@installer/domain/config.ts'
import { createDefaultSigner } from '@installer/infrastructure/signer.ts'
import type { InstallerDeps, InstallerDepsInput } from '@installer/types.ts'
import { silentLogger, systemClock } from '@loadstar/kernel'

export const resolveInstallerDeps = (
  input: InstallerDepsInput
): InstallerDeps => {
  const logger = (input.logger ?? silentLogger).child({ scope: 'installer' })

  return {
    devices: input.devices,
    apple: input.apple,
    catalog: input.catalog,
    secrets: input.secrets,
    scratch: input.scratch,
    signer: input.signer ?? createDefaultSigner(logger),
    logger,
    clock: input.clock ?? systemClock,
    config: { ...DEFAULT_INSTALLER_CONFIG, ...input.config }
  }
}
