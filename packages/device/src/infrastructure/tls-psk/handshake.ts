// The client side of a TLS 1.2 PSK handshake (RFC 4279, RFC 5246 §7), for TLS_PSK_WITH_AES_128_GCM_SHA256 with
// the extended master secret (RFC 7627) when the server agrees: ClientHello → ServerHello, [ServerKeyExchange],
// ServerHelloDone → ClientKeyExchange (empty identity), ChangeCipherSpec, Finished → ChangeCipherSpec, Finished.
import { sha256 } from '@noble/hashes/sha2.js'

import {
  ContentType,
  EXTENDED_MASTER_SECRET,
  FIXED_IV_BYTES,
  HandshakeType,
  KEY_BYTES,
  MASTER_SECRET_BYTES,
  PSK_AES_128_GCM_SHA256,
  RANDOM_BYTES,
  RENEGOTIATION_INFO,
  TLS_1_2,
  VERIFY_DATA_BYTES
} from '@device/infrastructure/tls-psk/constants.ts'
import { prf } from '@device/infrastructure/tls-psk/prf.ts'
import {
  encodeRecord,
  openRecord,
  sealRecord,
  tlsError
} from '@device/infrastructure/tls-psk/records.ts'
import type {
  HandshakeIo,
  HandshakeMessage,
  HandshakeResult,
  ServerHello,
  TlsRecord
} from '@device/infrastructure/tls-psk/types.ts'
import { ByteReader, ByteWriter, concatBytes } from '@ipaforge/kernel'

const handshakeMessage = (type: number, body: Uint8Array): Uint8Array =>
  new ByteWriter()
    .u8(type)
    .u8(body.length >> 16)
    .u16be(body.length & 0xff_ff)
    .bytes(body)
    .toBytes()

const clientHello = (random: Uint8Array): Uint8Array => {
  const extensions = new ByteWriter()
    .u16be(EXTENDED_MASTER_SECRET)
    .u16be(0)
    .u16be(RENEGOTIATION_INFO)
    .u16be(1)
    .u8(0)
    .toBytes()

  return handshakeMessage(
    HandshakeType.ClientHello,
    new ByteWriter()
      .u16be(TLS_1_2)
      .bytes(random)
      .u8(0) // no session id
      .u16be(2)
      .u16be(PSK_AES_128_GCM_SHA256)
      .u8(1)
      .u8(0) // null compression
      .u16be(extensions.length)
      .bytes(extensions)
      .toBytes()
  )
}

const alertError = (record: TlsRecord) =>
  tlsError('the server sent an alert', {
    level: record.fragment[0],
    description: record.fragment[1]
  })

/** Reads handshake messages, however records split or join them. */
const createMessageReader = (readRecord: HandshakeIo['readRecord']) => {
  let buffer: Uint8Array = new Uint8Array(0)

  return async (): Promise<HandshakeMessage> => {
    for (;;) {
      if (buffer.length >= 4) {
        const length =
          ((buffer[1] ?? 0) << 16) | ((buffer[2] ?? 0) << 8) | (buffer[3] ?? 0)
        if (buffer.length >= 4 + length) {
          const raw = buffer.slice(0, 4 + length)
          buffer = buffer.slice(4 + length)
          return { type: raw[0] ?? 0, body: raw.subarray(4), raw }
        }
      }
      const record = await readRecord()
      if (!record)
        throw tlsError('the server closed the connection during the handshake')
      if (record.type === ContentType.Alert) throw alertError(record)
      if (record.type !== ContentType.Handshake)
        throw tlsError('an unexpected record during the handshake', {
          type: record.type
        })
      buffer = concatBytes([buffer, record.fragment])
    }
  }
}

const readServerHello = (body: Uint8Array): ServerHello => {
  const reader = new ByteReader(body)
  const version = reader.u16be()
  const random = reader.bytes(RANDOM_BYTES)
  reader.skip(reader.u8()) // session id
  const suite = reader.u16be()
  reader.skip(1) // compression
  if (version !== TLS_1_2 || suite !== PSK_AES_128_GCM_SHA256)
    throw tlsError('the server chose another version or cipher suite', {
      version,
      suite
    })
  let extendedMasterSecret = false
  if (reader.remaining >= 2) {
    const end = reader.u16be() + reader.position
    while (reader.position < end) {
      const type = reader.u16be()
      reader.skip(reader.u16be())
      if (type === EXTENDED_MASTER_SECRET) extendedMasterSecret = true
    }
  }
  return { random, extendedMasterSecret }
}

/** RFC 4279 §2: the premaster secret for a plain PSK is N zero bytes and the N-byte key, each with its length. */
const premasterFor = (psk: Uint8Array): Uint8Array =>
  new ByteWriter()
    .u16be(psk.length)
    .bytes(new Uint8Array(psk.length))
    .u16be(psk.length)
    .bytes(psk)
    .toBytes()

const keysFrom = (
  master: Uint8Array,
  clientRandom: Uint8Array,
  serverRandom: Uint8Array
) => {
  const block = prf(
    master,
    'key expansion',
    concatBytes([serverRandom, clientRandom]),
    2 * KEY_BYTES + 2 * FIXED_IV_BYTES
  )
  const at = (start: number, length: number) =>
    block.slice(start, start + length)

  return {
    send: {
      key: at(0, KEY_BYTES),
      fixedIv: at(2 * KEY_BYTES, FIXED_IV_BYTES),
      sequence: 0n
    },
    receive: {
      key: at(KEY_BYTES, KEY_BYTES),
      fixedIv: at(2 * KEY_BYTES + FIXED_IV_BYTES, FIXED_IV_BYTES),
      sequence: 0n
    }
  }
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  let difference = a.length ^ b.length
  for (let index = 0; index < Math.min(a.length, b.length); index++)
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0)
  return difference === 0
}

export const handshake = async (
  { readRecord, write, randomBytes }: HandshakeIo,
  psk: Uint8Array
): Promise<HandshakeResult> => {
  const transcript: Uint8Array[] = []
  const hashed = () => sha256(concatBytes(transcript))
  const clientRandom = randomBytes(RANDOM_BYTES)

  const hello = clientHello(clientRandom)
  transcript.push(hello)
  await write(encodeRecord(ContentType.Handshake, hello))

  const nextMessage = createMessageReader(readRecord)
  const serverHelloMessage = await nextMessage()
  if (serverHelloMessage.type !== HandshakeType.ServerHello)
    throw tlsError('the server did not answer with ServerHello', {
      type: serverHelloMessage.type
    })
  transcript.push(serverHelloMessage.raw)
  const serverHello = readServerHello(serverHelloMessage.body)
  for (;;) {
    const message = await nextMessage()
    transcript.push(message.raw)
    if (message.type === HandshakeType.ServerHelloDone) break
    // A ServerKeyExchange only carries an identity hint for PSK; nothing to do with it.
    if (message.type !== HandshakeType.ServerKeyExchange)
      throw tlsError('an unexpected handshake message', { type: message.type })
  }

  // An empty PSK identity: the key itself is what both sides share.
  const keyExchange = handshakeMessage(
    HandshakeType.ClientKeyExchange,
    new Uint8Array([0, 0])
  )
  transcript.push(keyExchange)
  const premaster = premasterFor(psk)
  const master = serverHello.extendedMasterSecret
    ? prf(premaster, 'extended master secret', hashed(), MASTER_SECRET_BYTES)
    : prf(
        premaster,
        'master secret',
        concatBytes([clientRandom, serverHello.random]),
        MASTER_SECRET_BYTES
      )
  const keys = keysFrom(master, clientRandom, serverHello.random)

  const finished = handshakeMessage(
    HandshakeType.Finished,
    prf(master, 'client finished', hashed(), VERIFY_DATA_BYTES)
  )
  await write(
    concatBytes([
      encodeRecord(ContentType.Handshake, keyExchange),
      encodeRecord(ContentType.ChangeCipherSpec, new Uint8Array([1])),
      sealRecord(keys.send, ContentType.Handshake, finished)
    ])
  )
  transcript.push(finished)

  const changeCipherSpec = await readRecord()
  if (changeCipherSpec?.type === ContentType.Alert)
    throw alertError(changeCipherSpec)
  if (changeCipherSpec?.type !== ContentType.ChangeCipherSpec)
    throw tlsError('the server did not change cipher spec', {
      type: changeCipherSpec?.type
    })
  const serverFinishedRecord = await readRecord()
  if (
    !serverFinishedRecord ||
    serverFinishedRecord.type !== ContentType.Handshake
  )
    throw tlsError('the server did not finish the handshake')
  const serverFinished = openRecord(keys.receive, serverFinishedRecord)
  const expected = handshakeMessage(
    HandshakeType.Finished,
    prf(master, 'server finished', hashed(), VERIFY_DATA_BYTES)
  )
  if (!sameBytes(serverFinished, expected))
    throw tlsError(
      "the server's Finished doesn't match: it doesn't hold the same key"
    )

  return keys
}
