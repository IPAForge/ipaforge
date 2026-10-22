/** TLS 1.2 record content types (RFC 5246 §6.2.1). */
export const ContentType = {
  ChangeCipherSpec: 20,
  Alert: 21,
  Handshake: 22,
  ApplicationData: 23
} as const

/** Handshake message types used by a TLS 1.2 PSK client. */
export const HandshakeType = {
  ClientHello: 1,
  ServerHello: 2,
  ServerKeyExchange: 12,
  ServerHelloDone: 14,
  ClientKeyExchange: 16,
  Finished: 20
} as const

export const TLS_1_2 = 0x03_03

/** TLS_PSK_WITH_AES_128_GCM_SHA256 (RFC 5487): one that iOS's remote pairing tunnel accepts. */
export const PSK_AES_128_GCM_SHA256 = 0x00_a8

/** Extensions: extended master secret (RFC 7627) and secure renegotiation (RFC 5746), as common clients send. */
export const EXTENDED_MASTER_SECRET = 0x00_17
export const RENEGOTIATION_INFO = 0xff_01

export const RANDOM_BYTES = 32
export const MASTER_SECRET_BYTES = 48
export const VERIFY_DATA_BYTES = 12
export const KEY_BYTES = 16
export const FIXED_IV_BYTES = 4
export const EXPLICIT_NONCE_BYTES = 8
export const TAG_BYTES = 16
export const RECORD_HEADER_BYTES = 5
/** Most plaintext per record (RFC 5246 §6.2.1). */
export const MAX_FRAGMENT_BYTES = 16_384
/** Most ciphertext a record may carry: the plaintext limit plus room for the nonce and tag. */
export const MAX_RECORD_BYTES = MAX_FRAGMENT_BYTES + 2048

export const AlertDescription = {
  CloseNotify: 0
} as const
