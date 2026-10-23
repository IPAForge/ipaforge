// RemoteServiceDiscovery: the RemoteXPC handshake on a TCP connection to the RSD port inside the tunnel, which
// answers with the device's properties and the port of every service it offers.
//
// The client opens both streams the way the device mirrors back, then sends its own `Handshake` right away:
// current iOS sends its service map only in answer to one. The first message on the root stream is an empty
// dictionary with flags exactly AlwaysSet (with DataPresent added, the device goes silent).
import { z } from 'zod'

import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  HTTP2_DEFAULT_WINDOW_BYTES,
  Http2Flag,
  Http2FrameType,
  Http2Setting,
  RSD_HANDSHAKE_MESSAGE,
  RSD_MAX_CONCURRENT_STREAMS,
  RSD_MESSAGING_PROTOCOL_VERSION,
  RSD_REMOTE_XPC_VERSION_FLAGS,
  RSD_WINDOW_BYTES,
  XpcFlag,
  XpcStream
} from '@device/infrastructure/rsd/constants.ts'
import {
  describeGoAway,
  encodeHttp2Frame,
  http2Preface,
  readHttp2Frame,
  settingsPayload,
  windowUpdatePayload
} from '@device/infrastructure/rsd/http2.ts'
import type {
  Http2Frame,
  RsdHandshake,
  RsdService,
  XpcDictionary,
  XpcMessage,
  XpcValue
} from '@device/infrastructure/rsd/types.ts'
import {
  createXpcMessageReader,
  encodeXpcMessage,
  isXpcDictionary
} from '@device/infrastructure/rsd/xpc.ts'
import { XpcUuid } from '@device/infrastructure/rsd/xpc-uuid.ts'
import { concatBytes, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export type RsdHandshakeOptions = {
  /** Largest HTTP/2 frame or XPC message accepted from the device. */
  readonly maxMessageBytes: number
  /** How long the device may take to send its `Handshake`. */
  readonly timeoutMs: number
}

const integer = z.union([
  z.number().int(),
  z.bigint().transform(Number),
  z
    .string()
    .regex(/^\d{1,10}$/)
    .transform(Number)
])

const serviceSchema = z.looseObject({
  Port: integer.pipe(z.number().int().min(1).max(0xff_ff)),
  Entitlement: z.string().optional(),
  Properties: z
    .looseObject({ UsesRemoteXPC: z.boolean().optional() })
    .optional()
})

const handshakeSchema = z.looseObject({
  MessagingProtocolVersion: integer,
  Services: z.record(z.string(), serviceSchema),
  Properties: z.record(z.string(), z.custom<XpcValue>()).optional()
})

const frame = (
  type: number,
  streamId: number,
  payload: Uint8Array = new Uint8Array(),
  flags = 0
) => encodeHttp2Frame({ type, flags, streamId, payload })

const xpcData = (streamId: number, message: XpcMessage) =>
  frame(Http2FrameType.Data, streamId, encodeXpcMessage(message))

/** Everything the client sends before reading: the preface, SETTINGS, both streams opened, and its Handshake. */
const openingFrames = (uuid: Uint8Array): Uint8Array =>
  concatBytes([
    http2Preface(),
    frame(
      Http2FrameType.Settings,
      0,
      settingsPayload([
        [Http2Setting.MaxConcurrentStreams, RSD_MAX_CONCURRENT_STREAMS],
        [Http2Setting.InitialWindowSize, RSD_WINDOW_BYTES]
      ])
    ),
    frame(
      Http2FrameType.WindowUpdate,
      0,
      windowUpdatePayload(RSD_WINDOW_BYTES - HTTP2_DEFAULT_WINDOW_BYTES)
    ),
    frame(
      Http2FrameType.Headers,
      XpcStream.Root,
      undefined,
      Http2Flag.EndHeaders
    ),
    xpcData(XpcStream.Root, { flags: XpcFlag.AlwaysSet, id: 0n, body: {} }),
    xpcData(XpcStream.Root, {
      flags: XpcFlag.AlwaysSet | XpcFlag.ChannelOpen,
      id: 0n
    }),
    frame(
      Http2FrameType.Headers,
      XpcStream.Reply,
      undefined,
      Http2Flag.EndHeaders
    ),
    xpcData(XpcStream.Reply, {
      flags: XpcFlag.AlwaysSet | XpcFlag.InitHandshake,
      id: 0n
    }),
    xpcData(XpcStream.Root, {
      flags: XpcFlag.AlwaysSet | XpcFlag.DataPresent,
      id: 1n,
      body: {
        MessageType: RSD_HANDSHAKE_MESSAGE,
        MessagingProtocolVersion: RSD_MESSAGING_PROTOCOL_VERSION,
        UUID: new XpcUuid(uuid),
        Properties: {
          RemoteXPCVersionFlags: RSD_REMOTE_XPC_VERSION_FLAGS,
          SensitivePropertiesVisible: true
        },
        Services: {}
      }
    })
  ])

const toService = (
  name: string,
  entry: z.infer<typeof serviceSchema>
): RsdService => ({
  name,
  port: entry.Port,
  usesRemoteXpc: entry.Properties?.UsesRemoteXPC === true,
  ...(entry.Entitlement === undefined ? {} : { entitlement: entry.Entitlement })
})

const parseHandshake = (body: XpcDictionary): RsdHandshake => {
  const parsed = handshakeSchema.safeParse(body)
  if (!parsed.success)
    throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
      message: 'RSD: the device sent a Handshake IPAForge cannot read',
      cause: parsed.error
    })
  const { Services, Properties, MessagingProtocolVersion } = parsed.data

  return {
    services: new Map(
      Object.entries(Services).map(([name, entry]) => [
        name,
        toService(name, entry)
      ])
    ),
    properties: Properties ?? {},
    protocolVersion: MessagingProtocolVersion
  }
}

const isHandshake = (
  body: XpcValue | undefined
): body is XpcDictionary & { readonly Services: XpcValue } =>
  body !== undefined && isXpcDictionary(body) && 'Services' in body

/** Reads frames, answering SETTINGS and PING, until a message on any stream is the device's Handshake. */
const awaitHandshake = async (
  link: Link,
  maxMessageBytes: number
): Promise<RsdHandshake> => {
  const streams = new Map<number, ReturnType<typeof createXpcMessageReader>>()
  const messagesOn = (data: Http2Frame): XpcMessage[] => {
    let read = streams.get(data.streamId)
    if (!read) {
      read = createXpcMessageReader(maxMessageBytes)
      streams.set(data.streamId, read)
    }
    return read(data.payload)
  }
  for (;;) {
    const next = await readHttp2Frame(link, maxMessageBytes)
    const isAck = (next.flags & Http2Flag.Ack) !== 0
    if (next.type === Http2FrameType.Settings && !isAck)
      await link.write(
        frame(Http2FrameType.Settings, 0, undefined, Http2Flag.Ack)
      )
    else if (next.type === Http2FrameType.Ping && !isAck)
      await link.write(
        frame(Http2FrameType.Ping, 0, next.payload, Http2Flag.Ack)
      )
    else if (next.type === Http2FrameType.GoAway)
      throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
        message: 'RSD: the device closed the connection (GOAWAY)',
        data: describeGoAway(next.payload)
      })
    else if (next.type === Http2FrameType.Data) {
      const handshake = messagesOn(next).find((message) =>
        isHandshake(message.body)
      )
      if (handshake && isHandshake(handshake.body))
        return parseHandshake(handshake.body)
    }
  }
}

/**
 * Does the RemoteXPC handshake on `link` (a fresh TCP connection to the RSD port) and returns the device's
 * services and properties. Throws `device.timeout` when no Handshake comes within `timeoutMs`; the caller closes
 * the link either way.
 */
export const rsdHandshake = async (
  link: Link,
  { maxMessageBytes, timeoutMs }: RsdHandshakeOptions
): Promise<RsdHandshake> => {
  await link.write(
    openingFrames(globalThis.crypto.getRandomValues(new Uint8Array(16)))
  )
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new IPAForgeError(ErrorCode.DeviceTimeout, {
            message: `RSD: no Handshake from the device in ${timeoutMs} ms`
          })
        ),
      timeoutMs
    )
  })
  try {
    return await Promise.race([awaitHandshake(link, maxMessageBytes), timeout])
  } finally {
    clearTimeout(timer)
  }
}
