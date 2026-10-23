import type { XpcUuid } from '@device/infrastructure/rsd/xpc-uuid.ts'

/**
 * An XPC object. Integers are `number` for int64 and `bigint` for uint64 (so a round trip keeps the type); doubles
 * decode to `number` too, and a `number` that isn't an integer encodes as a double.
 */
export type XpcValue =
  | null
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | Date
  | XpcUuid
  | readonly XpcValue[]
  | XpcDictionary

export type XpcDictionary = { readonly [key: string]: XpcValue }

/** One XPC message as it travels on an HTTP/2 stream: the wrapper's flags and id, and its body (if any). */
export type XpcMessage = {
  readonly flags: number
  readonly id: bigint
  readonly body?: XpcValue
}

export type Http2Frame = {
  readonly type: number
  readonly flags: number
  readonly streamId: number
  readonly payload: Uint8Array
}

/** A service RSD lists: its port inside the tunnel, and whether it speaks RemoteXPC or a lockdown protocol (shims). */
export type RsdService = {
  readonly name: string
  readonly port: number
  readonly usesRemoteXpc: boolean
  readonly entitlement?: string
}

/** What the device's RSD `Handshake` says: its services and its properties (UDID, iOS version, model…). */
export type RsdHandshake = {
  readonly services: ReadonlyMap<string, RsdService>
  readonly properties: XpcDictionary
  readonly protocolVersion: number
}
