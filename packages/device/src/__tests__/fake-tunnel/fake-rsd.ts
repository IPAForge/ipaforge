// Test-only: the device's RSD inside the tunnel. It records what the client sends and, as current iOS does,
// answers with its service map only once the client's own Handshake arrives. Like the device, it goes silent when
// the first root message isn't flagged exactly AlwaysSet.
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  HTTP2_PREFACE,
  Http2Flag,
  Http2FrameType,
  XpcFlag,
  XpcStream
} from '@device/infrastructure/rsd/constants.ts'
import {
  encodeHttp2Frame,
  readHttp2Frame
} from '@device/infrastructure/rsd/http2.ts'
import type {
  Http2Frame,
  XpcDictionary,
  XpcMessage
} from '@device/infrastructure/rsd/types.ts'
import {
  createXpcMessageReader,
  encodeXpcMessage,
  isXpcDictionary
} from '@device/infrastructure/rsd/xpc.ts'
import { utf8Decode } from '@ipaforge/kernel'

export type FakeRsdOptions = {
  readonly services: XpcDictionary
  readonly properties?: XpcDictionary
  /** Never answer (as a device that didn't like the opening). */
  readonly silent?: boolean
  /** Close with GOAWAY instead of answering. */
  readonly goAway?: boolean
}

export type FakeRsdRecord = {
  preface: string
  readonly frames: Http2Frame[]
  /** XPC messages the client sent, per stream. */
  readonly messages: Map<number, XpcMessage[]>
}

const MAX_FRAME = 16 * 1024 * 1024

type Reply = (frame: Http2Frame) => Promise<void>

/** The answer to the client's Handshake: SETTINGS, a PING, then the service map split over two DATA frames. */
const answerHandshake = async (reply: Reply, options: FakeRsdOptions) => {
  if (options.goAway) {
    await reply({
      type: Http2FrameType.GoAway,
      flags: 0,
      streamId: 0,
      payload: new Uint8Array([0, 0, 0, 1, 0, 0, 0, 2])
    })
    return
  }
  await reply({
    type: Http2FrameType.Settings,
    flags: 0,
    streamId: 0,
    payload: new Uint8Array()
  })
  await reply({
    type: Http2FrameType.Ping,
    flags: 0,
    streamId: 0,
    payload: new Uint8Array(8)
  })
  const answer = encodeXpcMessage({
    flags: XpcFlag.AlwaysSet | XpcFlag.DataPresent,
    id: 1n,
    body: {
      MessageType: 'Handshake',
      MessagingProtocolVersion: 7n,
      Properties: options.properties ?? {},
      Services: options.services
    }
  })
  const half = Math.floor(answer.length / 2)
  for (const payload of [answer.subarray(0, half), answer.subarray(half)])
    await reply({
      type: Http2FrameType.Data,
      flags: 0,
      streamId: XpcStream.Root,
      payload
    })
}

const isHandshake = (message: XpcMessage): boolean =>
  message.body !== undefined &&
  isXpcDictionary(message.body) &&
  message.body.MessageType === 'Handshake'

export const serveFakeRsd = async (
  link: Link,
  options: FakeRsdOptions,
  record: FakeRsdRecord
): Promise<void> => {
  record.preface = utf8Decode(await link.reader.readExact(HTTP2_PREFACE.length))
  const readers = new Map<number, ReturnType<typeof createXpcMessageReader>>()
  let silent = options.silent ?? false
  const reply: Reply = (frame) => link.write(encodeHttp2Frame(frame))

  /** Records a message; true when it is the client's Handshake and the fake still answers. */
  const take = (streamId: number, message: XpcMessage): boolean => {
    const sent = record.messages.get(streamId) ?? []
    const isFirstOnRoot = streamId === XpcStream.Root && sent.length === 0
    if (isFirstOnRoot && message.flags !== XpcFlag.AlwaysSet) silent = true
    sent.push(message)
    record.messages.set(streamId, sent)
    return isHandshake(message) && !silent
  }

  const readerFor = (streamId: number) => {
    let read = readers.get(streamId)
    if (!read) {
      read = createXpcMessageReader(MAX_FRAME)
      readers.set(streamId, read)
    }
    return read
  }

  for (;;) {
    const frame = await readHttp2Frame(link, MAX_FRAME).catch(() => undefined)
    if (!frame) return
    record.frames.push(frame)
    if (frame.type !== Http2FrameType.Data) continue
    for (const message of readerFor(frame.streamId)(frame.payload))
      if (take(frame.streamId, message)) await answerHandshake(reply, options)
  }
}

/** Frames of `type` the client sent with the ACK flag. */
export const ackedFrames = (record: FakeRsdRecord, type: number) =>
  record.frames.filter(
    (frame) => frame.type === type && (frame.flags & Http2Flag.Ack) !== 0
  )
