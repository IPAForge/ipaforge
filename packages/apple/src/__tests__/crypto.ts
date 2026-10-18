// Test-only: server-side counterparts of the client crypto (what GrandSlam does), for the fake GSA.
import {
  ET_HEADER,
  ET_IV,
  hmacSha256,
  SPD_IV_LABEL,
  SPD_KEY_LABEL
} from '@apple/infrastructure/crypto/session.ts'
import {
  bigintFromBytes,
  bytesFromBigint,
  modPow,
  multiplier,
  privateKey,
  proof,
  SRP_G,
  SRP_N,
  scrambler,
  serverProof,
  sha256
} from '@apple/infrastructure/crypto/srp.ts'
import { equalBytes, utf8Encode } from '@ipaforge/kernel'

const buffer = (bytes: Uint8Array): Uint8Array<ArrayBuffer> =>
  bytes as Uint8Array<ArrayBuffer>

export const encryptSpd = async (
  sessionKey: Uint8Array,
  plain: Uint8Array
): Promise<Uint8Array> => {
  const key = await hmacSha256(sessionKey, utf8Encode(SPD_KEY_LABEL))
  const iv = (await hmacSha256(sessionKey, utf8Encode(SPD_IV_LABEL))).subarray(
    0,
    16
  )
  const aes = await crypto.subtle.importKey(
    'raw',
    buffer(key),
    'AES-CBC',
    false,
    ['encrypt']
  )

  return new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: buffer(iv) },
      aes,
      buffer(plain)
    )
  )
}

export const encryptAppToken = async (
  sessionKey: Uint8Array,
  plain: Uint8Array
): Promise<Uint8Array> => {
  const header = utf8Encode('XYZ')
  const iv = crypto.getRandomValues(new Uint8Array(ET_IV))
  const aes = await crypto.subtle.importKey(
    'raw',
    buffer(sessionKey),
    'AES-GCM',
    false,
    ['encrypt']
  )
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: buffer(header), tagLength: 128 },
      aes,
      buffer(plain)
    )
  )
  const out = new Uint8Array(ET_HEADER + ET_IV + sealed.byteLength)
  out.set(header, 0)
  out.set(iv, ET_HEADER)
  out.set(sealed, ET_HEADER + ET_IV)
  return out
}

/** The server half of SRP for one sign-in attempt. */
export const srpServer = async (passwordKey: Uint8Array, salt: Uint8Array) => {
  const x = await privateKey(salt, passwordKey)
  const v = modPow(SRP_G, x, SRP_N)
  const b = bigintFromBytes(crypto.getRandomValues(new Uint8Array(32)))
  const k = await multiplier()
  const B = (k * v + modPow(SRP_G, b, SRP_N)) % SRP_N

  return {
    B,
    /** Checks the client's proof; returns M2 and K, or undefined for a wrong password. */
    verify: async (username: string, A: bigint, M1: Uint8Array) => {
      const u = await scrambler(A, B)
      const S = modPow((A * modPow(v, u, SRP_N)) % SRP_N, b, SRP_N)
      const K = await sha256(bytesFromBigint(S))
      const expected = await proof(username, salt, A, B, K)
      if (!equalBytes(expected, M1)) return undefined
      return { M2: await serverProof(A, M1, K), K }
    }
  }
}
