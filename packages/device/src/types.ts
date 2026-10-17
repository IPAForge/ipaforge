import type { DeviceConfig } from '@device/domain/config.ts'
import type { DeviceTransport } from '@device/domain/ports/types.ts'
import type { Clock, Logger, SecretStore } from '@loadstar/kernel'

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>

/** Everything the device layer needs from its host. Only `transport` and `secrets` have no default. */
export type DeviceDeps = {
  readonly transport: DeviceTransport
  readonly secrets: SecretStore
  readonly logger: Logger
  readonly clock: Clock
  readonly sleep: Sleep
  readonly config: DeviceConfig
}

export type DeviceDepsInput = Pick<DeviceDeps, 'transport' | 'secrets'> &
  Partial<Omit<DeviceDeps, 'transport' | 'secrets' | 'config'>> & {
    readonly config?: Partial<DeviceConfig>
  }
