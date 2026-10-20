// SRP-6a as the device's pair-setup checks it (verified against an iPhone): RFC 5054's 3072-bit group with SHA-512;
// k = H(N | PAD(g)), u = H(A | B) unpadded, x = H(s | H(user ":" PIN)), K = H(S),
// M1 = H(H(N) xor H(g) | H(user) | s | PAD(A) | PAD(B) | K) with g unpadded, M2 = H(A | M1 | K). The client side
// only; native BigInt. A is always full-length, so its padded and plain forms agree.
import { sha512 } from '@noble/hashes/sha2.js'

import {
  SRP_3072_BYTES,
  SRP_3072_G,
  SRP_3072_N
} from '@device/domain/remote-pairing/constants.ts'
import {
  concatBytes,
  ErrorCode,
  fromHex,
  IPAForgeError,
  toHex,
  utf8Encode
} from '@ipaforge/kernel'

/** Size of the client's secret exponent. */
const SECRET_BYTES = 32

export const bigintOf = (bytes: Uint8Array): bigint =>
  bytes.byteLength === 0 ? 0n : BigInt(`0x${toHex(bytes)}`)

/** Big-endian, left-padded to the group's size (RFC 5054 PAD). */
export const padded = (value: bigint): Uint8Array => {
  const hex = value.toString(16).padStart(SRP_3072_BYTES * 2, '0')

  return fromHex(hex)
}

export const minimal = (value: bigint): Uint8Array => {
  const hex = value.toString(16)

  return fromHex(hex.length % 2 === 0 ? hex : `0${hex}`)
}

export const modPow = (base: bigint, exponent: bigint, modulus: bigint) => {
  let result = 1n
  let b = ((base % modulus) + modulus) % modulus
  let e = exponent
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus
    b = (b * b) % modulus
    e >>= 1n
  }
  return result
}

const hash = (...parts: readonly Uint8Array[]) => sha512(concatBytes(parts))

const N = SRP_3072_N
const g = SRP_3072_G

/** k = H(N | PAD(g)) */
export const k = bigintOf(hash(minimal(N), padded(g)))

export type SrpClient = {
  /** A, padded to the group's size: sent in M3. */
  readonly publicKey: Uint8Array
  /** From the device's salt and B: the proof to send (M1) and the shared key K. */
  respond(
    salt: Uint8Array,
    devicePublicKey: Uint8Array
  ): { readonly proof: Uint8Array; readonly sessionKey: Uint8Array }
  /** Whether the device's proof (M2) shows it knows the same K. */
  verify(deviceProof: Uint8Array): boolean
}

const refused = (message: string) =>
  new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: `remote pairing: ${message}`
  })

export const createSrpClient = (
  user: string,
  password: string,
  randomBytes: (length: number) => Uint8Array
): SrpClient => {
  let a = 0n
  let A = 0n
  // A full-length A (no leading zero byte) reads the same padded or not.
  while (a <= 1n || A % N === 0n || minimal(A).byteLength < SRP_3072_BYTES) {
    a = bigintOf(randomBytes(SECRET_BYTES))
    A = modPow(g, a, N)
  }
  const publicKey = padded(A)
  let expected: Uint8Array | undefined

  return {
    publicKey,
    respond: (salt, devicePublicKey) => {
      const B = bigintOf(devicePublicKey)
      if (B % N === 0n) throw refused("the device's SRP public key is invalid")
      const u = bigintOf(hash(publicKey, minimal(B)))
      if (u === 0n) throw refused('SRP scrambling parameter is zero')
      const x = bigintOf(hash(salt, hash(utf8Encode(`${user}:${password}`))))
      const base = (B - ((k * modPow(g, x, N)) % N) + N) % N
      const S = modPow(base, a + u * x, N)
      const sessionKey = hash(minimal(S))
      const hN = hash(minimal(N))
      const hg = hash(minimal(g))
      const proof = hash(
        hN.map((byte, index) => byte ^ (hg[index] ?? 0)),
        hash(utf8Encode(user)),
        salt,
        publicKey,
        padded(B),
        sessionKey
      )
      expected = hash(publicKey, proof, sessionKey)

      return { proof, sessionKey }
    },
    verify: (deviceProof) =>
      expected !== undefined &&
      expected.byteLength === deviceProof.byteLength &&
      expected.every((byte, index) => byte === deviceProof[index])
  }
}
