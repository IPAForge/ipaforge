export type ClientEphemeral = {
  readonly a: bigint
  readonly A: bigint
}

export type ClientProof = {
  readonly M1: Uint8Array
  /** Session key K = H(S). */
  readonly K: Uint8Array
}

export type PasswordProtocol = 's2k' | 's2k_fo'
