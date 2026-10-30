// The device side of remote pairing, for tests: an SRP server with the USB PIN, its own Ed25519 identity, and the
// replies to pair-setup (M2, M4, M6) and pair-verify (M2, M4), as a PairingChannel the host code talks to.
import { chacha20poly1305 } from '@noble/ciphers/chacha.js'
import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha512 } from '@noble/hashes/sha2.js'

import {
  SRP_3072_G as g,
  KeyDerivation,
  SRP_3072_N as N,
  Nonce,
  SRP_USER,
  TlvType,
  USB_PIN
} from '@device/domain/remote-pairing/constants.ts'
import { valueAt } from '@device/domain/remote-pairing/json.ts'
import {
  decodeOpack,
  encodeOpack
} from '@device/domain/remote-pairing/opack.ts'
import { decodeTlv8, encodeTlv8 } from '@device/domain/remote-pairing/tlv8.ts'
import type { TlvEntry } from '@device/domain/remote-pairing/types.ts'
import type { PairingChannel } from '@device/infrastructure/remote-pairing/channel.ts'
import {
  deriveKey,
  open,
  seal
} from '@device/infrastructure/remote-pairing/crypto.ts'
import {
  bigintOf,
  k,
  minimal,
  modPow,
  padded
} from '@device/infrastructure/remote-pairing/srp.ts'
import {
  concatBytes,
  fromBase64,
  toBase64,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

export const DEVICE_ID = 'device-identifier'
export const DEVICE_ALT_IRK = new Uint8Array(16).fill(7)

const hash = (...parts: Uint8Array[]) => sha512(concatBytes(parts))
const random = (length: number) =>
  globalThis.crypto.getRandomValues(new Uint8Array(length))

export type FakeRemoteDeviceOptions = {
  /** The port createListener answers with (a network connection's tunnel). */
  readonly listenerPort?: number
  /** The device asks the user first (sends awaitingUserConsent before M2). */
  readonly asksConsent?: boolean
  /** The device refuses outright, with this reason. */
  readonly rejectWith?: string
  /** The device forgot this computer: pair-verify ends with an error record. */
  readonly forgetsHost?: boolean
  /** The device signs its identity with another key (tampered). */
  readonly badSignature?: boolean
  /** The code it pairs with (an Apple TV's on-screen code); the fixed USB PIN otherwise. */
  readonly pin?: string
  /** A wrong code is answered with "try again in this many seconds" instead of an authentication error. */
  readonly backoffSeconds?: number
  /** What M6's info says the device is. */
  readonly model?: string
  readonly name?: string
}

const pairingData = (entries: readonly TlvEntry[]) => ({
  event: {
    _0: { pairingData: { _0: { data: toBase64(encodeTlv8(entries)) } } }
  }
})

export const createFakeRemoteDevice = (
  options: FakeRemoteDeviceOptions = {}
) => {
  const deviceSecret = ed25519.utils.randomSecretKey()
  const devicePublicKey = ed25519.getPublicKey(deviceSecret)
  const queue: Record<string, unknown>[] = []
  const sent: Record<string, unknown>[] = []
  const known = new Map<string, Uint8Array>()
  let setup:
    | { salt: Uint8Array; v: bigint; b: bigint; B: bigint; K?: Uint8Array }
    | undefined
  let verify:
    | {
        secret: Uint8Array
        publicKey: Uint8Array
        hostKey: Uint8Array
        key: Uint8Array
      }
    | undefined
  /** The pair-verify secret, keying the encrypted messages that follow it. */
  let shared: Uint8Array | undefined
  const encrypted: Record<string, unknown>[] = []
  let fromHost = 0
  let toHost = 0
  const errorRecord = () => pairingData([[TlvType.Error, new Uint8Array([2])]])
  // A wrong code: an authentication error, or "try again in this many seconds".
  const wrongProof = () =>
    options.backoffSeconds === undefined
      ? errorRecord()
      : pairingData([
          [TlvType.Error, new Uint8Array([3])],
          [TlvType.RetryDelay, new Uint8Array([options.backoffSeconds])]
        ])

  const setupStep = (tlv: ReadonlyMap<number, Uint8Array>) => {
    const step = tlv.get(TlvType.State)?.[0]
    if (step === 1) {
      if (options.rejectWith) {
        queue.push({
          event: {
            _0: {
              pairingRejectedWithError: {
                _0: {
                  wrappedError: {
                    userInfo: { NSLocalizedDescription: options.rejectWith }
                  }
                }
              }
            }
          }
        })
        return
      }
      const salt = random(16)
      const pin = options.pin ?? USB_PIN
      const x = bigintOf(hash(salt, hash(utf8Encode(`${SRP_USER}:${pin}`))))
      const v = modPow(g, x, N)
      const b = bigintOf(random(32))
      const B = (k * v + modPow(g, b, N)) % N
      setup = { salt, v, b, B }
      if (options.asksConsent)
        queue.push({ event: { _0: { awaitingUserConsent: { _0: {} } } } })
      queue.push(
        pairingData([
          [TlvType.State, new Uint8Array([2])],
          [TlvType.Salt, salt],
          [TlvType.PublicKey, minimal(B)]
        ])
      )
      return
    }
    if (!setup) throw new Error('setup out of order')
    if (step === 3) {
      const A = bigintOf(tlv.get(TlvType.PublicKey) ?? new Uint8Array())
      const u = bigintOf(hash(minimal(A), minimal(setup.B)))
      const S = modPow((A * modPow(setup.v, u, N)) % N, setup.b, N)
      const K = hash(minimal(S))
      const hN = hash(minimal(N))
      const hg = hash(minimal(g))
      const M1 = hash(
        hN.map((byte, index) => byte ^ (hg[index] ?? 0)),
        hash(utf8Encode(SRP_USER)),
        setup.salt,
        padded(A),
        padded(setup.B),
        K
      )
      const proof = tlv.get(TlvType.Proof) ?? new Uint8Array()
      if (toBase64(M1) !== toBase64(proof)) {
        queue.push(wrongProof())
        return
      }
      setup.K = K
      queue.push(
        pairingData([
          [TlvType.State, new Uint8Array([4])],
          [TlvType.Proof, hash(minimal(A), M1, K)]
        ])
      )
      return
    }
    if (step === 5 && setup.K) {
      const K = setup.K
      const key = deriveKey(K, KeyDerivation.setupEncrypt)
      const host = decodeTlv8(
        open(
          key,
          Nonce.setupM5,
          tlv.get(TlvType.EncryptedData) ?? new Uint8Array()
        )
      )
      const hostId = host.get(TlvType.Identifier) ?? new Uint8Array()
      const hostKey = host.get(TlvType.PublicKey) ?? new Uint8Array()
      const signed = concatBytes([
        deriveKey(K, KeyDerivation.controllerSign),
        hostId,
        hostKey
      ])
      if (
        !ed25519.verify(
          host.get(TlvType.Signature) ?? new Uint8Array(),
          signed,
          hostKey
        )
      ) {
        queue.push(errorRecord())
        return
      }
      decodeOpack(host.get(TlvType.Info) ?? new Uint8Array())
      known.set(utf8Decode(hostId), hostKey)
      const id = utf8Encode(DEVICE_ID)
      const deviceSigned = concatBytes([
        deriveKey(K, KeyDerivation.accessorySign),
        id,
        devicePublicKey
      ])
      const signer = options.badSignature
        ? ed25519.utils.randomSecretKey()
        : deviceSecret
      queue.push(
        pairingData([
          [TlvType.State, new Uint8Array([6])],
          [
            TlvType.EncryptedData,
            seal(
              key,
              Nonce.setupM6,
              encodeTlv8([
                [TlvType.Identifier, id],
                [TlvType.PublicKey, devicePublicKey],
                [TlvType.Signature, ed25519.sign(deviceSigned, signer)],
                [
                  TlvType.Info,
                  encodeOpack({
                    accountID: DEVICE_ID,
                    altIRK: DEVICE_ALT_IRK,
                    model: options.model ?? 'iPhone17,1',
                    name: options.name ?? 'iPhone',
                    remotepairing_udid: 'UDID'
                  })
                ]
              ])
            )
          ]
        ])
      )
    }
  }

  const verifyStep = (tlv: ReadonlyMap<number, Uint8Array>) => {
    const step = tlv.get(TlvType.State)?.[0]
    if (step === 1) {
      const secret = random(32)
      const publicKey = x25519.getPublicKey(secret)
      const hostKey = tlv.get(TlvType.PublicKey) ?? new Uint8Array()
      const key = deriveKey(
        x25519.getSharedSecret(secret, hostKey),
        KeyDerivation.verifyEncrypt
      )
      verify = { secret, publicKey, hostKey, key }
      shared = x25519.getSharedSecret(secret, hostKey)
      const id = utf8Encode(DEVICE_ID)
      queue.push(
        pairingData([
          [TlvType.State, new Uint8Array([2])],
          [TlvType.PublicKey, publicKey],
          [
            TlvType.EncryptedData,
            seal(
              key,
              Nonce.verifyM2,
              encodeTlv8([
                [TlvType.Identifier, id],
                [
                  TlvType.Signature,
                  ed25519.sign(
                    concatBytes([publicKey, id, hostKey]),
                    deviceSecret
                  )
                ]
              ])
            )
          ]
        ])
      )
      return
    }
    if (step === 3 && verify) {
      const host = decodeTlv8(
        open(
          verify.key,
          Nonce.verifyM3,
          tlv.get(TlvType.EncryptedData) ?? new Uint8Array()
        )
      )
      const hostId = host.get(TlvType.Identifier) ?? new Uint8Array()
      const hostLongTerm = known.get(utf8Decode(hostId))
      const signed = concatBytes([verify.hostKey, hostId, verify.publicKey])
      const accepted =
        !options.forgetsHost &&
        hostLongTerm !== undefined &&
        ed25519.verify(
          host.get(TlvType.Signature) ?? new Uint8Array(),
          signed,
          hostLongTerm
        )
      queue.push(
        accepted
          ? pairingData([[TlvType.State, new Uint8Array([4])]])
          : errorRecord()
      )
    }
  }

  const channel: PairingChannel = {
    send: async (body) => {
      sent.push(body)
      if (valueAt(body, ['request', '_0', 'handshake'])) {
        queue.push({
          response: { _1: { handshake: { _0: { peerDeviceInfo: {} } } } }
        })
        return
      }
      const event = valueAt(body, ['event', '_0', 'pairingData', '_0'])
      const data = valueAt(event, ['data'])
      const kind = valueAt(event, ['kind'])
      if (typeof data !== 'string') return
      const tlv = decodeTlv8(fromBase64(data))
      if (kind === 'setupManualPairing') setupStep(tlv)
      else verifyStep(tlv)
    },
    receive: async () => {
      const next = queue.shift()
      if (!next) throw new Error('the fake device has nothing to say')
      return next
    },
    sendMessage: async (message) => {
      const plain = valueAt(message, ['plain', '_0'])
      if (plain && typeof plain === 'object')
        return channel.send(plain as Record<string, unknown>)
      const sealed = valueAt(message, ['streamEncrypted', '_0'])
      if (typeof sealed !== 'string' || !shared)
        throw new Error('the fake device got a message it cannot read')
      const key = (info: string) =>
        hkdf(
          sha512,
          shared ?? new Uint8Array(),
          new Uint8Array(0),
          utf8Encode(info),
          32
        )
      const nonce = (counter: number) => {
        const bytes = new Uint8Array(12)
        new DataView(bytes.buffer).setBigUint64(0, BigInt(counter), true)
        return bytes
      }
      const body = JSON.parse(
        utf8Decode(
          chacha20poly1305(
            key('ClientEncrypt-main'),
            nonce(fromHost++)
          ).decrypt(fromBase64(sealed))
        )
      ) as Record<string, unknown>
      encrypted.push(body)
      const reply = valueAt(body, ['request', '_0', 'createListener'])
        ? {
            response: {
              _1: {
                createListener: {
                  port: options.listenerPort ?? 50_000,
                  serviceName: 'FAKE-SERVICE',
                  devicePublicKey: 'FAKE'
                }
              }
            }
          }
        : {
            response: {
              _1: { errorExtended: { _0: { reason: 'unknown request' } } }
            }
          }
      queue.push({
        streamEncrypted: {
          _0: toBase64(
            chacha20poly1305(
              key('ServerEncrypt-main'),
              nonce(toHost++)
            ).encrypt(utf8Encode(JSON.stringify(reply)))
          )
        }
      })
    },
    receiveMessage: async () => {
      const next = queue.shift()
      if (!next) throw new Error('the fake device has nothing to say')
      return next.streamEncrypted ? next : { plain: { _0: next } }
    },
    close: async () => {}
  }

  return {
    channel,
    sent,
    encrypted,
    devicePublicKey,
    known,
    shared: () => shared
  }
}
