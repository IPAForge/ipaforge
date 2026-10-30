import type { RecordType } from '@device/infrastructure/mdns/constants.ts'
import type { Sleep } from '@device/types.ts'
import type { Logger } from '@ipaforge/kernel'

type RecordBase = {
  readonly name: string
  /** Seconds; 0 is a goodbye (the record is withdrawn). */
  readonly ttl: number
}

export type ResourceRecord =
  | (RecordBase & {
      readonly type: typeof RecordType.PTR
      readonly target: string
    })
  | (RecordBase & {
      readonly type: typeof RecordType.SRV
      readonly port: number
      readonly target: string
    })
  | (RecordBase & {
      readonly type: typeof RecordType.TXT
      readonly entries: readonly string[]
    })
  | (RecordBase & {
      readonly type: typeof RecordType.A
      readonly address: string
    })
  | (RecordBase & {
      readonly type: typeof RecordType.AAAA
      readonly address: string
    })

export type DnsQuestion = {
  readonly name: string
  readonly type: number
}

export type DnsMessage = {
  readonly id: number
  readonly isResponse: boolean
  /** Answers, then authority and additional records: every record the message carries, in order. */
  readonly records: readonly ResourceRecord[]
}

/** A device advertising a service on the network (lockdown over Wi-Fi, remote pairing), as one search found it. */
export type WifiAdvert = {
  /** The service instance name (`<MAC>@<address>-supportsRP-NN…`), the advert's identity on this network. */
  readonly instance: string
  /** Its IPv4 address, or its IPv6 one when it gave no IPv4 address. */
  readonly address: string
  /** The service's port (SRV), when the answer gave it. */
  readonly port?: number | undefined
  /** The MAC address in the instance name: the device's real one, or a private one for this network. */
  readonly mac?: string | undefined
  /** TXT `identifier` and `authTag` values (iOS 26.4 and later), checked against the pair records. */
  readonly identifier?: string | undefined
  readonly authTags: readonly string[]
  /** TXT `name` and `model`: what an Apple TV or Vision Pro's pairing advert calls itself. */
  readonly name?: string | undefined
  readonly model?: string | undefined
}

export type BrowseEvent =
  | { readonly kind: 'found'; readonly advert: WifiAdvert }
  | { readonly kind: 'lost'; readonly instance: string }

export type BrowseOptions = {
  readonly sleep: Sleep
  /** Milliseconds since some fixed point, to time rounds. */
  readonly now: () => number
  readonly intervalMs: number
  readonly logger: Logger
}

/** What one search knows of an instance before its address is in: where it is, and its TXT values. */
export type PendingAdvert = {
  host?: string
  port?: number
  identifier?: string | undefined
  authTags: string[]
  name?: string | undefined
  model?: string | undefined
}
