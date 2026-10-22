export type TlsRecord = {
  readonly type: number
  readonly fragment: Uint8Array
}

/** One direction's record protection after ChangeCipherSpec: AES-128-GCM key, fixed IV and sequence number. */
export type RecordKeys = {
  readonly key: Uint8Array
  readonly fixedIv: Uint8Array
  sequence: bigint
}

export type HandshakeMessage = {
  readonly type: number
  readonly body: Uint8Array
  /** Header and body, as the transcript hashes it. */
  readonly raw: Uint8Array
}

export type HandshakeIo = {
  readonly readRecord: () => Promise<TlsRecord | null>
  readonly write: (bytes: Uint8Array) => Promise<void>
  readonly randomBytes: (length: number) => Uint8Array
}

export type HandshakeResult = {
  readonly send: RecordKeys
  readonly receive: RecordKeys
}

export type ServerHello = {
  readonly random: Uint8Array
  readonly extendedMasterSecret: boolean
}
