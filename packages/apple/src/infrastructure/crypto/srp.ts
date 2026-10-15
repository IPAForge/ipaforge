// SRP-6a as GrandSlam uses it: RFC 5054 2048-bit group, SHA-256, RFC 5054 padding for k and u, and the
// username left out of x (x = H(s | H(":" | P))). Native BigInt; no external big-number code.
import {
  concatBytes,
  ErrorCode,
  fromHex,
  LoadstarError,
  toHex,
  utf8Encode
} from '@loadstar/kernel'

/** RFC 5054 Appendix A, 2048-bit group. */
export const SRP_N = BigInt(
  '0xAC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC3192943DB56050A37329CBB4A099ED8193E0757767A1' +
    '3DD52312AB4B03310DCD7F48A9DA04FD50E8083969EDB767B0CF6095179A163AB3661A05FBD5FAAAE82918A9962F0B' +
    '93B855F97993EC975EEAA80D740ADBF4FF747359D041D5C33EA71D281E446B14773BCA97B43A23FB801676BD207A43' +
    '6C6481F1D2B9078717461A5B9D32E688F87748544523B524B0D57D5EA77A2775D2ECFA032CFBDBF52FB37861602790' +
    '04E57AE6AF874E7303CE53299CCC041C7BC308D82A5698F3A8D0C38271AE35F8E9DBFBB694B5C803D89F7AE435DE23' +
    '6D525F54759B65E372FCD68EF20FA7111F9E4AFF73'
)
export const SRP_G = 2n
export const SRP_N_BYTES = 256
/** Size of the client's secret exponent. */
const SECRET_BYTES = 32

export const bigintFromBytes = (bytes: Uint8Array): bigint =>
  bytes.byteLength === 0 ? 0n : BigInt(`0x${toHex(bytes)}`)

/** Minimal big-endian encoding (no leading zero bytes), like most SRP implementations' `long_to_bytes`. */
export const bytesFromBigint = (value: bigint): Uint8Array => {
  if (value === 0n) return new Uint8Array([0])
  const hex = value.toString(16)

  return fromHex(hex.length % 2 === 0 ? hex : `0${hex}`)
}

/** Left-pads to the length of N (RFC 5054 PAD). */
export const pad = (value: bigint, length = SRP_N_BYTES): Uint8Array => {
  const bytes = bytesFromBigint(value)
  if (bytes.byteLength >= length) return bytes
  const out = new Uint8Array(length)
  out.set(bytes, length - bytes.byteLength)
  return out
}

export const modPow = (
  base: bigint,
  exponent: bigint,
  modulus: bigint
): bigint => {
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

export const sha256 = async (
  ...parts: readonly Uint8Array[]
): Promise<Uint8Array> =>
  new Uint8Array(
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      concatBytes(parts) as Uint8Array<ArrayBuffer>
    )
  )

const xor = (a: Uint8Array, b: Uint8Array): Uint8Array =>
  a.map((byte, i) => byte ^ (b[i] ?? 0))

/** k = H(N | PAD(g)) */
export const multiplier = async (): Promise<bigint> =>
  bigintFromBytes(await sha256(bytesFromBigint(SRP_N), pad(SRP_G)))

/** u = H(PAD(A) | PAD(B)) */
export const scrambler = async (A: bigint, B: bigint): Promise<bigint> =>
  bigintFromBytes(await sha256(pad(A), pad(B)))

/** x = H(s | H(":" | P)): GrandSlam leaves the username out. */
export const privateKey = async (
  salt: Uint8Array,
  passwordKey: Uint8Array
): Promise<bigint> =>
  bigintFromBytes(
    await sha256(salt, await sha256(utf8Encode(':'), passwordKey))
  )

export type ClientEphemeral = {
  readonly a: bigint
  readonly A: bigint
}

export const clientEphemeral = (
  randomBytes: (length: number) => Uint8Array
): ClientEphemeral => {
  for (;;) {
    const a = bigintFromBytes(randomBytes(SECRET_BYTES))
    const A = modPow(SRP_G, a, SRP_N)
    if (a > 1n && A % SRP_N !== 0n) return { a, A }
  }
}

export type ClientProof = {
  readonly M1: Uint8Array
  /** Session key K = H(S). */
  readonly K: Uint8Array
}

/** M1 = H(H(N) xor H(PAD(g)) | H(I) | s | A | B | K) */
export const proof = async (
  username: string,
  salt: Uint8Array,
  A: bigint,
  B: bigint,
  K: Uint8Array
): Promise<Uint8Array> => {
  const hNg = xor(
    await sha256(bytesFromBigint(SRP_N)),
    await sha256(pad(SRP_G))
  )

  return sha256(
    hNg,
    await sha256(utf8Encode(username)),
    salt,
    bytesFromBigint(A),
    bytesFromBigint(B),
    K
  )
}

export const clientProof = async (input: {
  readonly username: string
  readonly salt: Uint8Array
  readonly passwordKey: Uint8Array
  readonly ephemeral: ClientEphemeral
  readonly B: bigint
}): Promise<ClientProof> => {
  const { a, A } = input.ephemeral
  const B = input.B
  if (B % SRP_N === 0n)
    throw new LoadstarError(ErrorCode.AppleProtocolError, {
      message: 'SRP: invalid server value B'
    })
  const u = await scrambler(A, B)
  if (u === 0n)
    throw new LoadstarError(ErrorCode.AppleProtocolError, {
      message: 'SRP: invalid scrambler'
    })
  const k = await multiplier()
  const x = await privateKey(input.salt, input.passwordKey)
  const base = (((B - k * modPow(SRP_G, x, SRP_N)) % SRP_N) + SRP_N) % SRP_N
  const S = modPow(base, a + u * x, SRP_N)
  const K = await sha256(bytesFromBigint(S))

  return { M1: await proof(input.username, input.salt, A, B, K), K }
}

/** M2 = H(A | M1 | K) */
export const serverProof = (
  A: bigint,
  M1: Uint8Array,
  K: Uint8Array
): Promise<Uint8Array> => sha256(bytesFromBigint(A), M1, K)

export type PasswordProtocol = 's2k' | 's2k_fo'

/** P = PBKDF2-SHA256(SHA256(password) [hex-encoded for s2k_fo], salt, iterations, 32). */
export const passwordKey = async (
  password: string,
  salt: Uint8Array,
  iterations: number,
  protocol: PasswordProtocol
): Promise<Uint8Array> => {
  const digest = await sha256(utf8Encode(password))
  const material = protocol === 's2k_fo' ? utf8Encode(toHex(digest)) : digest
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    material as Uint8Array<ArrayBuffer>,
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations
    },
    key,
    256
  )

  return new Uint8Array(bits)
}
