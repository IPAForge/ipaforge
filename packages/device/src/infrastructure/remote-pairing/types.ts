import type { RemotePairingRecord } from '@device/domain/remote-pairing/types.ts'

/** What the device says about itself in M6: its UDID, name and model, when it gives them. */
export type PeerInfo = {
  readonly udid?: string
  readonly name?: string
  readonly model?: string
}

/** A finished pair-setup: the remote pairing, and what the device said about itself. */
export type PairSetupResult = {
  readonly record: RemotePairingRecord
  readonly peer: PeerInfo
}
