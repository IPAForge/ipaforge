// The CDTunnel handshake on a fresh CoreDeviceProxy connection: we ask for an MTU, the device answers with both
// tunnel addresses, the agreed MTU and the RSD port. After it the connection carries raw IPv6 packets back to back.
import { z } from 'zod'

import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  CDTUNNEL_LENGTH_BYTES,
  CDTUNNEL_MAGIC,
  CDTUNNEL_REQUEST,
  CDTUNNEL_RESPONSE
} from '@device/infrastructure/tunnel/constants.ts'
import type { TunnelParameters } from '@device/infrastructure/tunnel/types.ts'
import {
  ByteWriter,
  ErrorCode,
  IPAForgeError,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

const responseSchema = z.looseObject({
  type: z.literal(CDTUNNEL_RESPONSE),
  serverAddress: z.string().min(2),
  serverRSDPort: z.number().int().min(1).max(0xff_ff),
  clientParameters: z.looseObject({
    address: z.string().min(2),
    mtu: z.number().int().min(1280)
  })
})

const malformed = (message: string, cause?: unknown) =>
  new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: `CDTunnel: ${message}`,
    ...(cause === undefined ? {} : { cause })
  })

export const encodeCdTunnelMessage = (body: unknown): Uint8Array => {
  const json = utf8Encode(JSON.stringify(body))

  return new ByteWriter(
    CDTUNNEL_MAGIC.length + CDTUNNEL_LENGTH_BYTES + json.length
  )
    .bytes(utf8Encode(CDTUNNEL_MAGIC))
    .u16be(json.length)
    .bytes(json)
    .toBytes()
}

/** The JSON body of the next handshake message. */
export const readCdTunnelMessage = async (link: Link): Promise<unknown> => {
  const magic = utf8Decode(await link.reader.readExact(CDTUNNEL_MAGIC.length))
  if (magic !== CDTUNNEL_MAGIC) throw malformed('bad magic')
  const header = await link.reader.readExact(CDTUNNEL_LENGTH_BYTES)
  const length = new DataView(header.buffer, header.byteOffset, 2).getUint16(0)
  const text = utf8Decode(await link.reader.readExact(length))
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw malformed('the handshake is not JSON', error)
  }
}

/** Asks for a tunnel with packets of at most `mtu` bytes and returns what the device agreed. */
export const cdTunnelHandshake = async (
  link: Link,
  mtu: number
): Promise<TunnelParameters> => {
  await link.write(encodeCdTunnelMessage({ type: CDTUNNEL_REQUEST, mtu }))
  const parsed = responseSchema.safeParse(await readCdTunnelMessage(link))
  if (!parsed.success)
    throw malformed('unexpected handshake response', parsed.error)
  const { serverAddress, serverRSDPort, clientParameters } = parsed.data

  return {
    clientAddress: clientParameters.address,
    serverAddress,
    rsdPort: serverRSDPort,
    mtu: clientParameters.mtu
  }
}
