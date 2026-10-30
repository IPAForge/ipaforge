// SipHash-2-4 (Aumasson and Bernstein, 2012): a keyed 64-bit hash. Remote pairing adverts are signed with it, keyed
// by the device's identity resolving key. Returns the 8 output bytes, little-endian, as the reference code does.

const MASK = 0xff_ff_ff_ff_ff_ff_ff_ffn
const KEY_BYTES = 16

const rotl = (value: bigint, bits: bigint): bigint =>
  ((value << bits) | (value >> (64n - bits))) & MASK

const readU64 = (bytes: Uint8Array, offset: number): bigint => {
  let value = 0n
  for (let index = 7; index >= 0; index--)
    value = (value << 8n) | BigInt(bytes[offset + index] ?? 0)
  return value
}

export const sipHash24 = (key: Uint8Array, message: Uint8Array): Uint8Array => {
  if (key.byteLength !== KEY_BYTES)
    throw new RangeError('SipHash needs a 16-byte key')
  const k0 = readU64(key, 0)
  const k1 = readU64(key, 8)
  let v0 = k0 ^ 0x73_6f_6d_65_70_73_65_75n
  let v1 = k1 ^ 0x64_6f_72_61_6e_64_6f_6dn
  let v2 = k0 ^ 0x6c_79_67_65_6e_65_72_61n
  let v3 = k1 ^ 0x74_65_64_62_79_74_65_73n

  const round = () => {
    v0 = (v0 + v1) & MASK
    v1 = rotl(v1, 13n) ^ v0
    v0 = rotl(v0, 32n)
    v2 = (v2 + v3) & MASK
    v3 = rotl(v3, 16n) ^ v2
    v0 = (v0 + v3) & MASK
    v3 = rotl(v3, 21n) ^ v0
    v2 = (v2 + v1) & MASK
    v1 = rotl(v1, 17n) ^ v2
    v2 = rotl(v2, 32n)
  }
  const compress = (word: bigint) => {
    v3 ^= word
    round()
    round()
    v0 ^= word
  }

  const whole = message.byteLength - (message.byteLength % 8)
  for (let offset = 0; offset < whole; offset += 8)
    compress(readU64(message, offset))
  let last = BigInt(message.byteLength & 0xff) << 56n
  for (let index = whole; index < message.byteLength; index++)
    last |= BigInt(message[index] ?? 0) << BigInt(8 * (index - whole))
  compress(last)
  v2 ^= 0xffn
  for (let count = 0; count < 4; count++) round()
  let hash = v0 ^ v1 ^ v2 ^ v3

  const out = new Uint8Array(8)
  for (let index = 0; index < 8; index++) {
    out[index] = Number(hash & 0xffn)
    hash >>= 8n
  }
  return out
}
