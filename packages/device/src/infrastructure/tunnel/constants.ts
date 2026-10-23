// The iOS 17.4+ device tunnel: the CDTunnel handshake, then raw IPv6 packets carrying TCP (RFC 8200, RFC 9293,
// RFC 7323). Protocol constants, not configuration.

/** Every CDTunnel handshake message: this ASCII magic, a u16 big-endian length, then UTF-8 JSON. */
export const CDTUNNEL_MAGIC = 'CDTunnel'
export const CDTUNNEL_LENGTH_BYTES = 2
export const CDTUNNEL_REQUEST = 'clientHandshakeRequest'
export const CDTUNNEL_RESPONSE = 'serverHandshakeResponse'

export const IPV6_HEADER_BYTES = 40
export const IPV6_VERSION = 6
export const IPV6_ADDRESS_BYTES = 16
export const IPV6_GROUPS = 8
/** Hop limit on every packet we send: the device is the only hop. */
export const IPV6_HOP_LIMIT = 64
/** Next-header numbers: the only one we use, and the ones the device also sends (ignored). */
export const NEXT_HEADER_TCP = 6

export const TCP_HEADER_BYTES = 20
/** IPv6 and TCP headers without options: what a packet carries besides its payload. */
export const TCP_PACKET_OVERHEAD = IPV6_HEADER_BYTES + TCP_HEADER_BYTES

export const TcpFlag = {
  Fin: 0x01,
  Syn: 0x02,
  Rst: 0x04,
  Psh: 0x08,
  Ack: 0x10
} as const

export const TcpOption = {
  End: 0,
  Nop: 1,
  MaxSegmentSize: 2,
  WindowScale: 3
} as const

/** The window field is 16 bits; window scaling shifts it by at most 14 (RFC 7323 §2.3). */
export const TCP_MAX_WINDOW_FIELD = 0xff_ff
export const TCP_MAX_WINDOW_SHIFT = 14
/** The send MSS when the peer gives none (RFC 9293 §3.7.1, for IPv6). */
export const TCP_DEFAULT_IPV6_MSS = 1220

/** Local ports for our connections (the dynamic range, RFC 6335). */
export const EPHEMERAL_PORT_FIRST = 49_152
export const EPHEMERAL_PORT_LAST = 65_535
