// IPv6 (RFC 8200) as the tunnel carries it: text addresses, the fixed 40-byte header (no extension headers on what
// we send), and the ones' complement checksum over the pseudo-header that TCP uses (RFC 1071).
import type { StreamReader } from '@device/infrastructure/framing/stream-reader.ts'
import {
  IPV6_ADDRESS_BYTES,
  IPV6_GROUPS,
  IPV6_HEADER_BYTES,
  IPV6_HOP_LIMIT,
  IPV6_VERSION
} from '@device/infrastructure/tunnel/constants.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const malformed = (message: string) =>
  new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: `tunnel: ${message}`
  })

const HEX_GROUP = /^[\da-f]{1,4}$/i

const groupsOf = (part: string): string[] =>
  part === '' ? [] : part.split(':')

/** `2001:db8::2` → 16 bytes. No zone ids or embedded IPv4: the tunnel never uses them. */
export const parseIpv6Address = (text: string): Uint8Array => {
  const halves = text.split('::')
  if (halves.length > 2) throw malformed(`bad IPv6 address ${text}`)
  const head = groupsOf(halves[0] ?? '')
  const tail = groupsOf(halves[1] ?? '')
  const missing = IPV6_GROUPS - head.length - tail.length
  const groups =
    halves.length === 2
      ? [...head, ...Array<string>(missing).fill('0'), ...tail]
      : head
  if (
    groups.length !== IPV6_GROUPS ||
    (halves.length === 2 && missing < 1) ||
    !groups.every((group) => HEX_GROUP.test(group))
  )
    throw malformed(`bad IPv6 address ${text}`)
  const bytes = new Uint8Array(IPV6_ADDRESS_BYTES)
  const view = new DataView(bytes.buffer)
  for (const [index, group] of groups.entries())
    view.setUint16(index * 2, Number.parseInt(group, 16))

  return bytes
}

/** Writes the fixed header at the start of `packet` (traffic class and flow label zero). */
export const writeIpv6Header = (
  packet: Uint8Array,
  nextHeader: number,
  source: Uint8Array,
  destination: Uint8Array
): void => {
  const view = new DataView(packet.buffer, packet.byteOffset, IPV6_HEADER_BYTES)
  view.setUint32(0, IPV6_VERSION << 28)
  view.setUint16(4, packet.length - IPV6_HEADER_BYTES)
  packet[6] = nextHeader
  packet[7] = IPV6_HOP_LIMIT
  packet.set(source, 8)
  packet.set(destination, 24)
}

/** One packet as read from the tunnel: its next header, addresses and payload. */
export const readIpv6Packet = async (reader: StreamReader) => {
  const header = await reader.readExact(IPV6_HEADER_BYTES)
  if (header[0] === undefined || header[0] >> 4 !== IPV6_VERSION)
    throw malformed('the tunnel lost packet framing (not an IPv6 header)')
  const payloadLength = new DataView(
    header.buffer,
    header.byteOffset,
    IPV6_HEADER_BYTES
  ).getUint16(4)

  return {
    nextHeader: header[6] ?? 0,
    source: header.subarray(8, 24),
    destination: header.subarray(24, 40),
    payload: await reader.readExact(payloadLength)
  }
}

/** The 16-bit ones' complement sum of `bytes` (big-endian words, an odd last byte padded with zero), unfolded. */
const sum16 = (bytes: Uint8Array): number => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const even = bytes.length & ~1
  let sum = 0
  for (let offset = 0; offset < even; offset += 2) sum += view.getUint16(offset)
  if (even < bytes.length) sum += (bytes[even] ?? 0) << 8
  return sum
}

/**
 * The checksum of an upper-layer `segment` (RFC 8200 §8.1): the ones' complement of the sum over the pseudo-header
 * (addresses, length, next header) and the segment. Over a segment whose checksum field is filled in, a correct
 * one gives 0.
 */
export const upperLayerChecksum = (
  source: Uint8Array,
  destination: Uint8Array,
  nextHeader: number,
  segment: Uint8Array
): number => {
  let sum =
    sum16(source) +
    sum16(destination) +
    Math.floor(segment.length / 0x1_00_00) +
    (segment.length & 0xff_ff) +
    nextHeader +
    sum16(segment)
  while (sum > 0xff_ff) sum = (sum & 0xff_ff) + Math.floor(sum / 0x1_00_00)

  return ~sum & 0xff_ff
}
