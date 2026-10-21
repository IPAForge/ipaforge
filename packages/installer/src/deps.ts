import { DEFAULT_INSTALLER_CONFIG } from '@installer/domain/config.ts'
import { createMemoryInstalledStore } from '@installer/infrastructure/memory-installed-store.ts'
import { createMemoryKeptIpaStore } from '@installer/infrastructure/memory-kept-ipa-store.ts'
import { createDefaultSigner } from '@installer/infrastructure/signer.ts'
import type { InstallerDeps, InstallerDepsInput } from '@installer/types.ts'
import { silentLogger, systemClock } from '@ipaforge/kernel'

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
    installed: input.installed ?? createMemoryInstalledStore(),
    kept: input.kept ?? createMemoryKeptIpaStore(),
    signer: input.signer ?? createDefaultSigner(logger),
    ...(input.signedIpaFolder
      ? { signedIpaFolder: input.signedIpaFolder }
      : {}),
    logger,
    clock: input.clock ?? systemClock,
    config: { ...DEFAULT_INSTALLER_CONFIG, ...input.config }
  }
}
