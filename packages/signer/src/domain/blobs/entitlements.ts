import {
  compareBytes,
  concatBytes,
  ErrorCode,
  isPlistDict,
  LoadstarError,
  type PlistDict,
  PlistReal,
  type PlistValue,
  serializeXmlPlist,
  utf8Encode
} from '@loadstar/kernel'
import {
  CSMAGIC_EMBEDDED_DER_ENTITLEMENTS,
  CSMAGIC_EMBEDDED_ENTITLEMENTS
} from '@signer/domain/blobs/constants.ts'
import { wrapBlob } from '@signer/domain/blobs/super-blob.ts'

/** Slot 5: the entitlements plist bytes, verbatim (codesign does not re-serialize them). */
export const entitlementsXmlBlob = (plistBytes: Uint8Array): Uint8Array =>
  wrapBlob(CSMAGIC_EMBEDDED_ENTITLEMENTS, plistBytes)

/** Entitlements dict → CoreFoundation-formatted XML (what Xcode writes into .xcent files). */
export const serializeEntitlements = (entitlements: PlistDict): Uint8Array =>
  serializeXmlPlist(entitlements)

// ---- DER (slot 7), CoreEntitlements encoding --------------------------------------------------

const derLength = (length: number): number[] => {
  if (length < 0x80) return [length]
  const bytes: number[] = []
  for (let n = length; n > 0; n = Math.floor(n / 256)) bytes.unshift(n & 0xff)
  return [0x80 | bytes.length, ...bytes]
}

const tlv = (tag: number, body: Uint8Array): Uint8Array =>
  concatBytes([new Uint8Array([tag, ...derLength(body.byteLength)]), body])

/** Minimal two's-complement big-endian integer (0 → 00, 128 → 00 80, −1 → FF). */
const derInteger = (value: number | bigint): Uint8Array => {
  let n = BigInt(value)
  const bytes: number[] = []
  for (;;) {
    bytes.unshift(Number(n & 0xffn))
    const sign = n & 0x80n
    n >>= 8n
    if ((n === 0n && sign === 0n) || (n === -1n && sign !== 0n)) break
  }
  return tlv(0x02, new Uint8Array(bytes))
}

const unsupported = (type: string): never => {
  throw new LoadstarError(ErrorCode.InvalidPlist, {
    message: `entitlements cannot contain ${type} values (not representable in DER)`
  })
}

const derValue = (value: PlistValue): Uint8Array => {
  if (typeof value === 'string') return tlv(0x0c, utf8Encode(value))
  if (typeof value === 'boolean')
    return tlv(0x01, new Uint8Array([value ? 0xff : 0x00]))
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) return unsupported('non-integer number')
    return derInteger(value)
  }
  if (typeof value === 'bigint') return derInteger(value)
  if (value instanceof PlistReal) return unsupported('real')
  if (value instanceof Uint8Array) return unsupported('data')
  if (value instanceof Date) return unsupported('date')
  if (Array.isArray(value)) return tlv(0x30, concatBytes(value.map(derValue)))
  if (!isPlistDict(value)) return unsupported('unknown')

  // [CONTEXT 16] { SEQUENCE { UTF8String key, value } … } sorted by UTF-8 key bytes
  const entries = Object.keys(value)
    .map((key) => ({ key: utf8Encode(key), value: value[key] as PlistValue }))
    .sort((a, b) => compareBytes(a.key, b.key))
    .map((entry) =>
      tlv(0x30, concatBytes([tlv(0x0c, entry.key), derValue(entry.value)]))
    )

  return tlv(0xb0, concatBytes(entries))
}

/** Slot 7: `[APPLICATION 16] { INTEGER 1, dict }` wrapped in a 0xfade7172 blob. */
export const entitlementsDerBlob = (entitlements: PlistDict): Uint8Array =>
  wrapBlob(
    CSMAGIC_EMBEDDED_DER_ENTITLEMENTS,
    tlv(0x70, concatBytes([derInteger(1), derValue(entitlements)]))
  )
