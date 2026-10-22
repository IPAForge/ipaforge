// iOS 26.4 and later sign their Wi-Fi advert for each paired computer: the `authTag` TXT value is the start of
// HMAC-SHA256(key, identifier), the key being HKDF-SHA512 of that computer's HostID (no salt, no info, 32 bytes).
// It survives Private Wi-Fi Address, which changes the MAC address on every network. Verified on iOS 26.6.1.
import { fromBase64, utf8Encode } from '@ipaforge/kernel'

const KEY_BYTES = 32

/** iOS sends the first 8 bytes of the HMAC; any other length is refused, so a short forged tag can't match. */
export const AUTH_TAG_BYTES = 8

/** WebCrypto wants bytes backed by a plain ArrayBuffer. */
const buffer = (bytes: Uint8Array): Uint8Array<ArrayBuffer> =>
  new Uint8Array(bytes)

const keyFor = async (hostId: string): Promise<CryptoKey> => {
  const subtle = globalThis.crypto.subtle
  const ikm = await subtle.importKey(
    'raw',
    buffer(utf8Encode(hostId)),
    'HKDF',
    false,
    ['deriveBits']
  )
  const bits = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-512',
      salt: new Uint8Array(0),
      info: new Uint8Array(0)
    },
    ikm,
    KEY_BYTES * 8
  )

  return subtle.importKey(
    'raw',
    bits,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

/** Whether `tag` (base64) is what a device paired with this HostID sends for `identifier`. */
export const authTagMatches = async (
  hostId: string,
  identifier: string,
  tag: string
): Promise<boolean> => {
  let wanted: Uint8Array
  try {
    wanted = fromBase64(tag)
  } catch {
    return false
  }
  if (wanted.length !== AUTH_TAG_BYTES) return false
  const mac = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      'HMAC',
      await keyFor(hostId),
      buffer(utf8Encode(identifier))
    )
  )
  // Every byte is compared, whatever differs first.
  let difference = 0
  for (let index = 0; index < AUTH_TAG_BYTES; index++)
    difference |= (wanted[index] ?? 0) ^ (mac[index] ?? 0)

  return difference === 0
}
