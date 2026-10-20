// The symmetric half of remote pairing: HKDF-SHA512 keys from the SRP or X25519 secret, and ChaCha20-Poly1305 with
// 4 zero bytes then an 8-byte message label as the nonce, and no associated data.
import { chacha20poly1305 } from '@noble/ciphers/chacha.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha512 } from '@noble/hashes/sha2.js'

import { utf8Encode } from '@ipaforge/kernel'

const KEY_BYTES = 32
const NONCE_PREFIX_BYTES = 4

export const deriveKey = (
  secret: Uint8Array,
  [salt, info]: readonly [string, string]
): Uint8Array =>
  hkdf(sha512, secret, utf8Encode(salt), utf8Encode(info), KEY_BYTES)

const nonceOf = (label: string): Uint8Array => {
  const nonce = new Uint8Array(NONCE_PREFIX_BYTES + label.length)
  nonce.set(utf8Encode(label), NONCE_PREFIX_BYTES)
  return nonce
}

export const seal = (key: Uint8Array, label: string, plain: Uint8Array) =>
  chacha20poly1305(key, nonceOf(label)).encrypt(plain)

/** Throws when the data was changed or sealed with another key (Poly1305 tag mismatch). */
export const open = (key: Uint8Array, label: string, sealed: Uint8Array) =>
  chacha20poly1305(key, nonceOf(label)).decrypt(sealed)
