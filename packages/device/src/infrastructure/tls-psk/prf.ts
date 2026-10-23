// The TLS 1.2 pseudorandom function with SHA-256 (RFC 5246 §5): P_SHA256(secret, label + seed).
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'

import { concatBytes, utf8Encode } from '@ipaforge/kernel'

export const prf = (
  secret: Uint8Array,
  label: string,
  seed: Uint8Array,
  length: number
): Uint8Array => {
  const labelSeed = concatBytes([utf8Encode(label), seed])
  const out = new Uint8Array(length)
  let a = labelSeed
  for (let filled = 0; filled < length; ) {
    a = hmac(sha256, secret, a)
    const block = hmac(sha256, secret, concatBytes([a, labelSeed]))
    out.set(block.subarray(0, length - filled), filled)
    filled += block.length
  }
  return out
}
