import { resolveAppleConfig } from '@apple/domain/config.ts'
import type { AppleDeps, AppleDepsInput, Sleep } from '@apple/types.ts'
import { silentLogger, systemClock } from '@ipaforge/kernel'

const realSleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true }
    )
  })

const secureRandomBytes = (length: number): Uint8Array =>
  globalThis.crypto.getRandomValues(new Uint8Array(length))

export const resolveAppleDeps = (input: AppleDepsInput): AppleDeps => ({
  http: input.http,
  webSocket: input.webSocket,
  secrets: input.secrets,
  logger: (input.logger ?? silentLogger).child({ scope: 'apple' }),
  clock: input.clock ?? systemClock,
  sleep: input.sleep ?? realSleep,
  random: input.random ?? Math.random,
  randomBytes: input.randomBytes ?? secureRandomBytes,
  config: resolveAppleConfig(input.config)
})
