import { resolveDeviceConfig } from '@device/domain/config.ts'
import type { DeviceDeps, DeviceDepsInput, Sleep } from '@device/types.ts'
import { silentLogger, systemClock } from '@ipaforge/kernel'

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
