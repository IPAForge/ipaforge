// Just enough HTTP/2 (RFC 9113) for RemoteXPC: frames in and out, SETTINGS and WINDOW_UPDATE payloads. Header
// blocks stay empty both ways (the device sends and accepts empty ones), so there is no HPACK.
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  HTTP2_FRAME_HEADER_BYTES,
  HTTP2_PREFACE
} from '@device/infrastructure/rsd/constants.ts'
import type { Http2Frame } from '@device/infrastructure/rsd/types.ts'
import {
  ByteReader,
  ByteWriter,
  ErrorCode,
  IPAForgeError,
  utf8Encode
} from '@ipaforge/kernel'

const STREAM_ID_MASK = 0x7f_ff_ff_ff

export const http2Preface = (): Uint8Array => utf8Encode(HTTP2_PREFACE)

export const encodeHttp2Frame = (frame: Http2Frame): Uint8Array =>
  new ByteWriter(HTTP2_FRAME_HEADER_BYTES + frame.payload.length)
    // 24-bit length: the top three bytes of a big-endian u32 holding length << 8.
    .u32be((frame.payload.length << 8) | frame.type)
    .u8(frame.flags)
    .u32be(frame.streamId & STREAM_ID_MASK)
    .bytes(frame.payload)
    .toBytes()

/** The next frame; refuses one whose payload is over `maxPayloadBytes`. */
export const readHttp2Frame = async (
  link: Link,
  maxPayloadBytes: number
): Promise<Http2Frame> => {
  const header = new ByteReader(
    await link.reader.readExact(HTTP2_FRAME_HEADER_BYTES)
  )
  const lengthAndType = header.u32be()
  const length = lengthAndType >>> 8
  const type = lengthAndType & 0xff
  const flags = header.u8()
  const streamId = header.u32be() & STREAM_ID_MASK
  if (length > maxPayloadBytes)
    throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
      message: `HTTP/2: a ${length}-byte frame exceeds the ${maxPayloadBytes}-byte limit`
    })

  return {
    type,
    flags,
    streamId,
    payload: await link.reader.readExact(length)
  }
}

/** A SETTINGS payload: each setting as a u16 id and a u32 value. */
export const settingsPayload = (
  settings: readonly (readonly [number, number])[]
): Uint8Array => {
  const writer = new ByteWriter(settings.length * 6)
  for (const [id, value] of settings) writer.u16be(id).u32be(value)
  return writer.toBytes()
}

/** A WINDOW_UPDATE payload: the increment, a u32 with its top bit reserved. */
export const windowUpdatePayload = (increment: number): Uint8Array =>
  new ByteWriter(4).u32be(increment & STREAM_ID_MASK).toBytes()

/** GOAWAY's last stream id and error code, for the error it becomes. */
export const describeGoAway = (payload: Uint8Array) => {
  const reader = new ByteReader(payload)
  if (reader.remaining < 8) return { lastStreamId: 0, errorCode: 0 }

  return {
    lastStreamId: reader.u32be() & STREAM_ID_MASK,
    errorCode: reader.u32be()
  }
}
