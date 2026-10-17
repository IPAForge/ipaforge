import type { LockdownPairRecord } from '@device/domain/pairing/types.ts'
import type { TlsCredentials } from '@device/domain/ports/types.ts'
import type { PlistValue } from '@loadstar/kernel'

export type StartedService = {
  readonly port: number
  readonly enableServiceSsl: boolean
}

export type LockdownClient = {
  queryType(): Promise<string>
  /** `undefined` when the key does not exist (`MissingValue`). */
  getValue(key?: string, domain?: string): Promise<PlistValue | undefined>
  setValue(domain: string, key: string, value: PlistValue): Promise<void>
  /** Returns the escrow bag the device hands out on a successful pairing. */
  pair(record: LockdownPairRecord): Promise<Uint8Array | undefined>
  validatePair(record: LockdownPairRecord): Promise<void>
  startSession(
    hostId: string,
    systemBuid: string
  ): Promise<{ sessionId: string; enableSessionSsl: boolean }>
  startTls(credentials: TlsCredentials): Promise<void>
  startService(service: string, escrowBag?: Uint8Array): Promise<StartedService>
  stopSession(sessionId: string): Promise<void>
  close(): Promise<void>
}
