// RemoteXPC as RSD speaks it inside the iOS 17.4+ tunnel: XPC objects in a wrapper, carried in the DATA frames of
// a minimal HTTP/2 connection. Protocol constants, not configuration.

/** Every XPC message starts with this wrapper magic (u32 little-endian), then flags, body length and message id. */
export const XPC_WRAPPER_MAGIC = 0x29_b0_0b_92
export const XPC_WRAPPER_BYTES = 24
/** A wrapper's body starts with the object magic and version (u32 little-endian each), then the root object. */
export const XPC_OBJECT_MAGIC = 0x42_13_37_42
export const XPC_OBJECT_VERSION = 5

/** Wrapper flags. */
export const XpcFlag = {
  AlwaysSet: 0x00_00_00_01,
  DataPresent: 0x00_00_01_00,
  /** Unnamed: the bodiless message that follows the empty dictionary on the root stream during the handshake. */
  ChannelOpen: 0x00_00_02_00,
  WantingReply: 0x00_01_00_00,
  Reply: 0x00_02_00_00,
  InitHandshake: 0x00_40_00_00
} as const

/** XPC object type tags (u32 little-endian). */
export const XpcType = {
  Null: 0x10_00,
  Bool: 0x20_00,
  Int64: 0x30_00,
  Uint64: 0x40_00,
  Double: 0x50_00,
  Date: 0x70_00,
  Data: 0x80_00,
  String: 0x90_00,
  Uuid: 0xa0_00,
  Array: 0xe0_00,
  Dictionary: 0xf0_00
} as const

export const XPC_UUID_BYTES = 16

/** HTTP/2 (RFC 9113): the client preface, frame header size and the frame types RemoteXPC uses. */
export const HTTP2_PREFACE = 'PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n'
export const HTTP2_FRAME_HEADER_BYTES = 9
/** The largest frame payload HTTP/2 allows at all (24-bit length). */
export const HTTP2_MAX_FRAME_BYTES = 0xff_ff_ff

export const Http2FrameType = {
  Data: 0x0,
  Headers: 0x1,
  RstStream: 0x3,
  Settings: 0x4,
  Ping: 0x6,
  GoAway: 0x7,
  WindowUpdate: 0x8
} as const

export const Http2Flag = {
  /** On SETTINGS and PING. */
  Ack: 0x1,
  EndHeaders: 0x4
} as const

export const Http2Setting = {
  MaxConcurrentStreams: 0x3,
  InitialWindowSize: 0x4
} as const

/** What the client offers: 100 streams, a 1 MiB window per stream and (after a WINDOW_UPDATE) for the connection. */
export const RSD_MAX_CONCURRENT_STREAMS = 100
export const RSD_WINDOW_BYTES = 1024 * 1024
/** HTTP/2 starts every connection window at 65,535 bytes. */
export const HTTP2_DEFAULT_WINDOW_BYTES = 65_535

/** RemoteXPC's two streams: the root channel carries requests, the reply channel the handshake's init. */
export const XpcStream = {
  Root: 1,
  Reply: 3
} as const

/** The client's own `Handshake` (current iOS sends its service map only in answer to one). */
export const RSD_HANDSHAKE_MESSAGE = 'Handshake'
/** iOS 18.2 answers 6, iOS 26 answers 7; offering 7 works with both. */
export const RSD_MESSAGING_PROTOCOL_VERSION = 7n
export const RSD_REMOTE_XPC_VERSION_FLAGS = 0x01_00_00_00_00_00_00_06n

/** A lockdown service's counterpart inside the tunnel is `<service>` plus this suffix. */
export const SHIM_SUFFIX = '.shim.remote'
/** The first request on a shim connection; the device answers it, then `StartService`. */
export const RSD_CHECKIN_REQUEST = 'RSDCheckin'
export const RSD_START_SERVICE_REPLY = 'StartService'
export const RSD_CHECKIN_PROTOCOL_VERSION = '2'
