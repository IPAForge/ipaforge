import { PLIST_SERVICE_HEADER_SIZE } from '@device/domain/constants.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  ByteWriter,
  ErrorCode,
  IPAForgeError,
  isPlistDict,
  type PlistDict,
  type PlistLimits,
  parsePlist,
  serializeXmlPlist
} from '@ipaforge/kernel'

export type FrameLimits = {
  readonly maxMessageBytes: number
  readonly plist: PlistLimits
}

/** Decodes a plist payload that must be a dict (every usbmuxd, lockdownd and service message is). */
export const decodeDict = (
  payload: Uint8Array,
  limits: PlistLimits,
  what: string
): PlistDict => {
  const value = parsePlist(payload, limits)
  if (!isPlistDict(value)) {
    throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
      message: `${what}: expected a dict`
    })
  }
  return value
}

export const checkLength = (
  length: number,
  limits: FrameLimits,
  what: string
): void => {
  if (length > limits.maxMessageBytes) {
    throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
      message: `${what}: ${length}-byte message exceeds the ${limits.maxMessageBytes}-byte limit`
    })
  }
}

/** Plist-service framing (lockdownd and most services): u32 big-endian length, then an XML plist. */
export const encodePlistFrame = (message: PlistDict): Uint8Array => {
  const body = serializeXmlPlist(message)

  return new ByteWriter(body.byteLength + PLIST_SERVICE_HEADER_SIZE)
    .u32be(body.byteLength)
    .bytes(body)
    .toBytes()
}

export const sendPlist = (link: Link, message: PlistDict): Promise<void> =>
  link.write(encodePlistFrame(message))

export const receivePlist = async (
  link: Link,
  limits: FrameLimits,
  what = 'plist service'
): Promise<PlistDict> => {
  const header = await link.reader.readExact(PLIST_SERVICE_HEADER_SIZE)
  const length = new DataView(
    header.buffer,
    header.byteOffset,
    header.byteLength
  ).getUint32(0, false)
  checkLength(length, limits, what)
  return decodeDict(await link.reader.readExact(length), limits.plist, what)
}
