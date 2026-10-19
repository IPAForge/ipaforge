import type { InstallerConfig } from '@installer/domain/config.ts'
import type { InstalledStore } from '@installer/domain/ports/installed-store.ts'
import type { KeptIpaStore } from '@installer/domain/ports/kept-ipa-store.ts'
import type { ScratchStore } from '@installer/domain/ports/scratch-store.ts'
import type { IpaSigner } from '@installer/domain/ports/types.ts'
import type { AppleAccounts } from '@ipaforge/apple'
import type { Catalog } from '@ipaforge/catalog'
import type { DeviceManager } from '@ipaforge/device'
import type { Clock, Logger, SecretStore } from '@ipaforge/kernel'

/** The contexts the installer orchestrates, and what it needs from its host. */
export type InstallerDeps = {
  readonly devices: DeviceManager
  readonly apple: AppleAccounts
  readonly catalog: Catalog
  /** Holds each team's development certificate and private key between runs. */
  readonly secrets: SecretStore
  readonly scratch: ScratchStore
  /** The apps installed on each device, remembered for Refresh. */
  readonly installed: InstalledStore
  /** Each installed app's original IPA, signed again by Refresh. */
  readonly kept: KeptIpaStore
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
