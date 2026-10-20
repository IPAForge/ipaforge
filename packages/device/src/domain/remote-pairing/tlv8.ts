// TLV8, the record format of pair-setup and pair-verify: a type byte, a length byte and up to 255 bytes. A longer
// value is split into consecutive records of the same type; reading joins them again.
import { TLV_FRAGMENT_BYTES } from '@device/domain/remote-pairing/constants.ts'
import type { TlvEntry, TlvMap } from '@device/domain/remote-pairing/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const fragmentsOf = ([type, value]: TlvEntry): number[] => {
  if (value.byteLength === 0) return [type, 0]
  const out: number[] = []
  for (
    let offset = 0;
    offset < value.byteLength;
    offset += TLV_FRAGMENT_BYTES
  ) {
    const part = value.subarray(offset, offset + TLV_FRAGMENT_BYTES)
    out.push(type, part.byteLength, ...part)
  }
  return out
}

export const encodeTlv8 = (entries: readonly TlvEntry[]): Uint8Array =>
  new Uint8Array(entries.flatMap(fragmentsOf))

const malformed = (message: string) =>
  new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: `remote pairing: ${message}`
  })

/** Joins consecutive records of one type; the same type appearing again later starts over (not used here). */
export const decodeTlv8 = (bytes: Uint8Array): TlvMap => {
  const values = new Map<number, Uint8Array>()
  let previous: number | undefined
  let offset = 0
  while (offset < bytes.byteLength) {
    if (offset + 2 > bytes.byteLength) throw malformed('truncated TLV8 header')
    const type = bytes[offset] as number
    const length = bytes[offset + 1] as number
    const value = bytes.subarray(offset + 2, offset + 2 + length)
    if (value.byteLength !== length) throw malformed('truncated TLV8 value')
    const joined = type === previous ? values.get(type) : undefined
    values.set(
      type,
      joined ? new Uint8Array([...joined, ...value]) : new Uint8Array(value)
    )
    previous = type
    offset += 2 + length
  }
  return values
}
