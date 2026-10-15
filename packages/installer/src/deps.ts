import {
  DEFAULT_INSTALLER_CONFIG,
  type InstallerConfig
} from '@installer/domain/config.ts'
import type { IpaSigner } from '@installer/domain/ports/ipa-signer.ts'
import type { ScratchStore } from '@installer/domain/ports/scratch-store.ts'
import { createDefaultSigner } from '@installer/infrastructure/signer.ts'
import type { AppleAccounts } from '@loadstar/apple'
import type { Catalog } from '@loadstar/catalog'
import type { DeviceManager } from '@loadstar/device'
import {
  type Clock,
  type Logger,
  type SecretStore,
  silentLogger,
  systemClock
} from '@loadstar/kernel'

/** The contexts the installer orchestrates, and what it needs from its host. */
export type InstallerDeps = {
  readonly devices: DeviceManager
  readonly apple: AppleAccounts
  readonly catalog: Catalog
  /** Holds each team's development certificate and private key between runs. */
  readonly secrets: SecretStore
  readonly scratch: ScratchStore
  readonly signer: IpaSigner
  readonly logger: Logger
  readonly clock: Clock
  readonly config: InstallerConfig
}

export type InstallerDepsInput = Pick<
  InstallerDeps,
  'devices' | 'apple' | 'catalog' | 'secrets' | 'scratch'
> &
  Partial<
    Omit<
      InstallerDeps,
      'devices' | 'apple' | 'catalog' | 'secrets' | 'scratch' | 'config'
    >
  > & {
    readonly config?: Partial<InstallerConfig>
  }

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
