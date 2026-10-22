// TCP segments (RFC 9293 §3.1) inside IPv6 packets: building one whole packet to send, reading one received, and
// the two SYN options we use, MSS and window scale (RFC 7323).
import {
  IPV6_HEADER_BYTES,
  NEXT_HEADER_TCP,
  TCP_HEADER_BYTES,
  TcpOption
} from '@device/infrastructure/tunnel/constants.ts'
import {
  upperLayerChecksum,
  writeIpv6Header
} from '@device/infrastructure/tunnel/ipv6.ts'
import type {
  TcpSegment,
  TcpSynOptions,
  TunnelAddresses
} from '@device/infrastructure/tunnel/types.ts'

const MSS_OPTION_BYTES = 4
const WINDOW_SCALE_OPTION_BYTES = 3

/** MSS, then NOP and window scale (so the options end on a 4-byte boundary). */
const encodeOptions = ({
  maxSegmentSize,
  windowShift
}: TcpSynOptions): number[] => [
  ...(maxSegmentSize === undefined
    ? []
    : [
        TcpOption.MaxSegmentSize,
        MSS_OPTION_BYTES,
        maxSegmentSize >> 8,
        maxSegmentSize & 0xff
      ]),
  ...(windowShift === undefined
    ? []
    : [
        TcpOption.Nop,
        TcpOption.WindowScale,
        WINDOW_SCALE_OPTION_BYTES,
        windowShift
      ])
]

/** One whole IPv6 packet carrying `segment` from `addresses.local` to `addresses.remote`. */
export const encodeTcpPacket = (
  addresses: TunnelAddresses,
  segment: Omit<TcpSegment, 'options' | 'payload'> & {
    readonly options?: TcpSynOptions
    readonly payload?: Uint8Array
  }
): Uint8Array => {
  const options = encodeOptions(segment.options ?? {})
  const payload = segment.payload ?? new Uint8Array()
  const headerBytes = TCP_HEADER_BYTES + options.length
  const packet = new Uint8Array(
    IPV6_HEADER_BYTES + headerBytes + payload.length
  )
  writeIpv6Header(packet, NEXT_HEADER_TCP, addresses.local, addresses.remote)
  const tcp = packet.subarray(IPV6_HEADER_BYTES)
  const view = new DataView(tcp.buffer, tcp.byteOffset, tcp.byteLength)
  view.setUint16(0, segment.sourcePort)
  view.setUint16(2, segment.destinationPort)
  view.setUint32(4, segment.seq)
  view.setUint32(8, segment.ack)
  tcp[12] = (headerBytes / 4) << 4
  tcp[13] = segment.flags
  view.setUint16(14, segment.window)
  tcp.set(options, TCP_HEADER_BYTES)
  tcp.set(payload, headerBytes)
  view.setUint16(
    16,
    upperLayerChecksum(addresses.local, addresses.remote, NEXT_HEADER_TCP, tcp)
  )

  return packet
}

/** The MSS and window-scale options in `options`; others are skipped, and a malformed list ends the scan. */
export const decodeOptions = (options: Uint8Array): TcpSynOptions => {
  let maxSegmentSize: number | undefined
  let windowShift: number | undefined
  for (let at = 0; at < options.length; ) {
    const kind = options[at] ?? TcpOption.End
    if (kind === TcpOption.End) break
    if (kind === TcpOption.Nop) {
      at++
      continue
    }
    const length = options[at + 1] ?? 0
    if (length < 2 || at + length > options.length) break
    if (kind === TcpOption.MaxSegmentSize && length === MSS_OPTION_BYTES)
      maxSegmentSize = ((options[at + 2] ?? 0) << 8) | (options[at + 3] ?? 0)
    if (kind === TcpOption.WindowScale && length === WINDOW_SCALE_OPTION_BYTES)
      windowShift = options[at + 2]
    at += length
  }

  return {
    ...(maxSegmentSize === undefined ? {} : { maxSegmentSize }),
    ...(windowShift === undefined ? {} : { windowShift })
  }
}

/** The segment in a received packet's payload, or `undefined` when it is cut short or fails its checksum. */
export const decodeTcpSegment = (
  addresses: TunnelAddresses,
  bytes: Uint8Array
): TcpSegment | undefined => {
  if (bytes.length < TCP_HEADER_BYTES) return undefined
  const headerBytes = ((bytes[12] ?? 0) >> 4) * 4
  if (headerBytes < TCP_HEADER_BYTES || headerBytes > bytes.length)
    return undefined
  // Sent by the device: from its address to ours.
  if (
    upperLayerChecksum(
      addresses.remote,
      addresses.local,
      NEXT_HEADER_TCP,
      bytes
    ) !== 0
  )
    return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  return {
    sourcePort: view.getUint16(0),
    destinationPort: view.getUint16(2),
    seq: view.getUint32(4),
    ack: view.getUint32(8),
    flags: bytes[13] ?? 0,
    window: view.getUint16(14),
    options: decodeOptions(bytes.subarray(TCP_HEADER_BYTES, headerBytes)),
    payload: bytes.subarray(headerBytes)
  }
}
