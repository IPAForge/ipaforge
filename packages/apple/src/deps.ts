import {
  type AppleConfig,
  type AppleConfigOverrides,
  resolveAppleConfig
} from '@apple/domain/config.ts'
import type { WebSocketFactory } from '@apple/domain/ports/web-socket.ts'
import {
  type Clock,
  type HttpClient,
  type Logger,
  type SecretStore,
  silentLogger,
  systemClock
} from '@loadstar/kernel'

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>

/** Everything the Apple account layer needs from its host. */
export type AppleDeps = {
  readonly http: HttpClient
  readonly webSocket: WebSocketFactory
  readonly secrets: SecretStore
  readonly logger: Logger
  readonly clock: Clock
  readonly sleep: Sleep
  /** Uniform random in [0, 1) for retry jitter. */
  readonly random: () => number
  /** Cryptographically secure bytes (SRP secrets, anisette identifiers). */
  readonly randomBytes: (length: number) => Uint8Array
  readonly config: AppleConfig
}

export type AppleDepsInput = Pick<AppleDeps, 'http' | 'webSocket' | 'secrets'> &
  Partial<Omit<AppleDeps, 'http' | 'webSocket' | 'secrets' | 'config'>> & {
    readonly config?: AppleConfigOverrides
  }

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
