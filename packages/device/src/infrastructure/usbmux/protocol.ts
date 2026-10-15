import {
  USBMUX_HEADER_SIZE,
  USBMUX_MESSAGE_PLIST,
  USBMUX_VERSION_PLIST
} from '@device/domain/constants.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  checkLength,
  decodeDict,
  type FrameLimits
} from '@device/infrastructure/framing/plist-frames.ts'
import { ByteWriter, type PlistDict, serializeXmlPlist } from '@loadstar/kernel'

/** usbmux plist packet: a 16-byte little-endian header (length incl. header, version, type, tag), then XML. */
export const encodeUsbmuxPacket = (
  tag: number,
  message: PlistDict
): Uint8Array => {
  const body = serializeXmlPlist(message)

  return new ByteWriter(USBMUX_HEADER_SIZE + body.byteLength)
    .u32le(USBMUX_HEADER_SIZE + body.byteLength)
    .u32le(USBMUX_VERSION_PLIST)
    .u32le(USBMUX_MESSAGE_PLIST)
    .u32le(tag)
    .bytes(body)
    .toBytes()
}

/** Swaps a 16-bit port into network byte order, as usbmuxd's `Connect` expects. */
export const toNetworkPort = (port: number): number =>
  ((port & 0xff) << 8) | ((port >> 8) & 0xff)

export type UsbmuxPacket = {
  readonly tag: number
  readonly message: PlistDict
}

export const readUsbmuxPacket = async (
  link: Link,
  limits: FrameLimits
): Promise<UsbmuxPacket> => {
  const header = await link.reader.readExact(USBMUX_HEADER_SIZE)
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength)
  const length = view.getUint32(0, true)
  const tag = view.getUint32(12, true)
  if (length < USBMUX_HEADER_SIZE) {
    return {
      tag,
      message: decodeDict(new Uint8Array(), limits.plist, 'usbmux')
    }
  }
  checkLength(length, limits, 'usbmux')
  const body = await link.reader.readExact(length - USBMUX_HEADER_SIZE)

  return { tag, message: decodeDict(body, limits.plist, 'usbmux') }
}
