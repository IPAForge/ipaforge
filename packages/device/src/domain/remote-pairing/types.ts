/** One TLV8 record before fragmentation. */
export type TlvEntry = readonly [type: number, value: Uint8Array]

/** A decoded TLV8 message: each type's value, fragments joined. */
export type TlvMap = ReadonlyMap<number, Uint8Array>

/** What OPACK carries here: the device info dictionaries of pair-setup. */
export type OpackValue =
  | boolean
  | null
  | number
  | string
  | Uint8Array
  | readonly OpackValue[]
  | { readonly [key: string]: OpackValue }

/**
 * A remote pairing with one device: this computer's long-term Ed25519 identity for it, the device's public key
 * (checked on every pair-verify), and the device's identity resolving key, which SideStore's file carries.
 */
export type RemotePairingRecord = {
  /** This computer's identifier, as the device knows it (a UUID string). */
  readonly identifier: string
  /** This computer's Ed25519 public key (32 bytes). */
  readonly publicKey: Uint8Array
  /** This computer's Ed25519 private key seed (32 bytes). */
  readonly privateKey: Uint8Array
  /** The device's identifier and Ed25519 public key from pair-setup. */
  readonly deviceIdentifier: string
  readonly devicePublicKey: Uint8Array
  /** The device's identity resolving key (16 bytes). */
  readonly altIrk: Uint8Array
}

/** What a body from the device says, for the pairing steps. */
export type DeviceMessage =
  | { readonly kind: 'handshake' }
  | { readonly kind: 'pairing-data'; readonly data: Uint8Array }
  /** The device shows a prompt and waits for the user. */
  | { readonly kind: 'awaiting-consent' }
  | { readonly kind: 'rejected'; readonly reason: string }
  /** Anything else (status events the steps don't need). */
  | { readonly kind: 'other' }

/** The pairing data events the host sends: their TLV8, kind and whether they start a session. */
export type PairingDataInput = {
  readonly data: Uint8Array
  readonly kind: string
  readonly startNewSession: boolean
  /** This computer's name, as the device shows it. */
  readonly sendingHost: string
}

/** This computer as it introduces itself in pair-setup: its long-term identity and the info dictionary's fields. */
export type HostIdentity = {
  /** A UUID string, the same every time for this device. */
  readonly identifier: string
  /** Ed25519 private key seed (32 bytes) and its public key. */
  readonly privateKey: Uint8Array
  readonly publicKey: Uint8Array
  /** The name the device shows for this computer. */
  readonly name: string
  readonly model: string
  /** This computer's own identity resolving key (16 bytes) and a MAC-style address (6 bytes), random per device. */
  readonly altIrk: Uint8Array
  readonly mac: Uint8Array
  readonly serialNumber: string
}
