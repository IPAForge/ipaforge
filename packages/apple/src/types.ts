import type { WebSocketFactory } from '@apple/domain/ports/types.ts'
import type { AppleConfig, AppleConfigOverrides } from '@apple/domain/types.ts'
import type { Clock, HttpClient, Logger, SecretStore } from '@ipaforge/kernel'

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
