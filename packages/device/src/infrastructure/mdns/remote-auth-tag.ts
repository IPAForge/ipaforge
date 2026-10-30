// A device's remote pairing advert (`_remotepairing._tcp`) is signed with its own identity resolving key, which
// pair-setup gave this computer: the `authTag` TXT value is 6 bytes of SipHash-2-4(key, identifier), the
// identifier being the advert's own (it changes now and then). Only a computer paired with the device can tell it's
// that device.
import { sipHash24 } from '@device/domain/remote-pairing/siphash.ts'
import { fromBase64, utf8Encode } from '@ipaforge/kernel'

/** The tag is 6 bytes; any other length is refused, so a short forged one can't match. */
export const REMOTE_AUTH_TAG_BYTES = 6

/** The tag for `identifier`: the hash's first 6 bytes, last one first. */
export const remoteAuthTag = (
  altIrk: Uint8Array,
  identifier: string
): Uint8Array =>
  sipHash24(altIrk, utf8Encode(identifier))
    .subarray(0, REMOTE_AUTH_TAG_BYTES)
    .reverse()

const decodeTag = (tag: string): Uint8Array | undefined => {
  try {
    return fromBase64(tag)
  } catch {
    return undefined
  }
}

/** Whether `tag` is the device's with this identity resolving key, compared in constant time. */
export const remoteAuthTagMatches = (
  altIrk: Uint8Array,
  identifier: string,
  tag: string
): boolean => {
  const given = decodeTag(tag)
  if (given?.byteLength !== REMOTE_AUTH_TAG_BYTES) return false
  const expected = remoteAuthTag(altIrk, identifier)
  let difference = 0
  for (let index = 0; index < REMOTE_AUTH_TAG_BYTES; index++)
    difference |= (given[index] ?? 0) ^ (expected[index] ?? 0)

  return difference === 0
}
