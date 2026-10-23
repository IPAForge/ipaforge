// Remote pairing's frames over the lockdown service's connection: "RPPairing", a big-endian u16 length, then UTF-8
// JSON. Every JSON message is an envelope: the body under `message.plain._0`, who sent it, and the host's own
// sequence number (from 0). Byte fields inside bodies are base64 strings.
import {
  FRAME_MAGIC,
  MAX_FRAME_BYTES
} from '@device/domain/remote-pairing/constants.ts'
import { isRecord } from '@device/domain/remote-pairing/json.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  ErrorCode,
  IPAForgeError,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

const MAGIC = utf8Encode(FRAME_MAGIC)
const LENGTH_BYTES = 2

export type PairingChannel = {
  /** Sends one body in a plain envelope. */
  send(body: Record<string, unknown>): Promise<void>
  /** The next body the device sent. */
  receive(): Promise<Record<string, unknown>>
  /** Sends an envelope with this `message` (plain or encrypted), with the next sequence number. */
  sendMessage(message: Record<string, unknown>): Promise<void>
  /** The next envelope's `message`, whatever it holds. */
  receiveMessage(): Promise<Record<string, unknown>>
  close(): Promise<void>
}

const malformed = (message: string) =>
  new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: `remote pairing: ${message}`
  })

export const encodeFrame = (json: unknown): Uint8Array => {
  const body = utf8Encode(JSON.stringify(json))
  if (body.byteLength > MAX_FRAME_BYTES) throw malformed('frame too large')
  const frame = new Uint8Array(
    MAGIC.byteLength + LENGTH_BYTES + body.byteLength
  )
  frame.set(MAGIC)
  new DataView(frame.buffer).setUint16(MAGIC.byteLength, body.byteLength)
  frame.set(body, MAGIC.byteLength + LENGTH_BYTES)
  return frame
}

/** The body inside an envelope; an encrypted one isn't expected while pairing. */
export const bodyOf = (envelope: unknown): Record<string, unknown> => {
  const message = isRecord(envelope) ? envelope.message : undefined
  const plain = isRecord(message) ? message.plain : undefined
  const body = isRecord(plain) ? plain._0 : undefined
  if (isRecord(body)) return body
  if (isRecord(message) && 'streamEncrypted' in message)
    throw malformed('an encrypted message came before pairing finished')
  throw malformed('a message without a plain body')
}

export const createPairingChannel = (link: Link): PairingChannel => {
  let sequenceNumber = 0

  const sendMessage = async (message: Record<string, unknown>) => {
    const envelope = { message, originatedBy: 'host', sequenceNumber }
    sequenceNumber += 1
    await link.write(encodeFrame(envelope))
  }

  const receiveEnvelope = async (): Promise<unknown> => {
    const magic = await link.reader.readExact(MAGIC.byteLength)
    if (!magic.every((byte, index) => byte === MAGIC[index]))
      throw malformed('a frame without the RPPairing tag')
    const header = await link.reader.readExact(LENGTH_BYTES)
    const length = new DataView(header.buffer, header.byteOffset).getUint16(0)
    const json = utf8Decode(await link.reader.readExact(length))
    try {
      return JSON.parse(json)
    } catch {
      throw malformed('a frame that is not JSON')
    }
  }

  return {
    send: (body) => sendMessage({ plain: { _0: body } }),
    receive: async () => bodyOf(await receiveEnvelope()),
    sendMessage,
    receiveMessage: async () => {
      const envelope = await receiveEnvelope()
      const message = isRecord(envelope) ? envelope.message : undefined
      if (!isRecord(message)) throw malformed('an envelope without a message')
      return message
    },
    close: () => link.close()
  }
}
