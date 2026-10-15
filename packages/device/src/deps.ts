import {
  type DeviceConfig,
  resolveDeviceConfig
} from '@device/domain/config.ts'
import type { DeviceTransport } from '@device/domain/ports/transport.ts'
import {
  type Clock,
  type Logger,
  type SecretStore,
  silentLogger,
  systemClock
} from '@loadstar/kernel'

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

export const realSleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })

export const resolveDeviceDeps = (input: DeviceDepsInput): DeviceDeps => ({
  transport: input.transport,
  secrets: input.secrets,
  logger: (input.logger ?? silentLogger).child({ scope: 'device' }),
  clock: input.clock ?? systemClock,
  sleep: input.sleep ?? realSleep,
  config: resolveDeviceConfig(input.config)
})
