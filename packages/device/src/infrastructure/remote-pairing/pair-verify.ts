// Pair-verify: whether the device still accepts a remote pairing. A fresh X25519 exchange, the device proving it is
// the device pair-setup met (its Ed25519 signature over both ephemeral keys), then this computer proving the same.
// The device answers M3 with an error record when it no longer knows this computer.
import { ed25519, x25519 } from '@noble/curves/ed25519.js'

import {
  KeyDerivation,
  Nonce,
  PairingKind,
  TlvType
} from '@device/domain/remote-pairing/constants.ts'
import { decodeTlv8, encodeTlv8 } from '@device/domain/remote-pairing/tlv8.ts'
import type { RemotePairingRecord } from '@device/domain/remote-pairing/types.ts'
import type { PairingChannel } from '@device/infrastructure/remote-pairing/channel.ts'
import {
  deriveKey,
  open,
  seal
} from '@device/infrastructure/remote-pairing/crypto.ts'
import {
  exchange,
  handshake,
  requireTlv
} from '@device/infrastructure/remote-pairing/exchange.ts'
import {
  concatBytes,
  ErrorCode,
  IPAForgeError,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

export type PairVerifyOptions = {
  readonly record: RemotePairingRecord
  /** The name the device shows for this computer. */
  readonly hostName: string
  readonly randomBytes: (length: number) => Uint8Array
}

const X25519_KEY_BYTES = 32

const notAccepted = (message: string) =>
  new IPAForgeError(ErrorCode.PairingDenied, {
    message: `remote pairing not accepted: ${message}`
  })

export const pairVerify = async (
  channel: PairingChannel,
  { record, hostName, randomBytes }: PairVerifyOptions
): Promise<void> => {
  const step = (data: Uint8Array, startNewSession = false) =>
    exchange(channel, {
      data,
      kind: PairingKind.Verify,
      startNewSession,
      sendingHost: hostName
    })
  const secret = randomBytes(X25519_KEY_BYTES)
  const hostKey = x25519.getPublicKey(secret)

  await handshake(channel)
  const m2 = await step(
    encodeTlv8([
      [TlvType.State, new Uint8Array([1])],
      [TlvType.PublicKey, hostKey]
    ]),
    true
  )
  const deviceKey = requireTlv(m2, TlvType.PublicKey, 'verify key')
  const encryptKey = deriveKey(
    x25519.getSharedSecret(secret, deviceKey),
    KeyDerivation.verifyEncrypt
  )
  let device: ReturnType<typeof decodeTlv8>
  try {
    device = decodeTlv8(
      open(
        encryptKey,
        Nonce.verifyM2,
        requireTlv(m2, TlvType.EncryptedData, 'proof')
      )
    )
  } catch (error) {
    if (error instanceof IPAForgeError) throw error
    throw notAccepted("the device's proof doesn't open")
  }
  const deviceIdentifier = requireTlv(device, TlvType.Identifier, 'identifier')
  if (utf8Decode(deviceIdentifier) !== record.deviceIdentifier)
    throw notAccepted('another device answered')
  const signed = concatBytes([deviceKey, deviceIdentifier, hostKey])
  if (
    !ed25519.verify(
      requireTlv(device, TlvType.Signature, 'signature'),
      signed,
      record.devicePublicKey
    )
  )
    throw notAccepted("the device's signature doesn't match the pairing")

  // M3 → M4: this computer's proof; an error record (raised by `exchange`) means it isn't known any more.
  await step(
    encodeTlv8([
      [TlvType.State, new Uint8Array([3])],
      [
        TlvType.EncryptedData,
        seal(
          encryptKey,
          Nonce.verifyM3,
          encodeTlv8([
            [TlvType.Identifier, utf8Encode(record.identifier)],
            [
              TlvType.Signature,
              ed25519.sign(
                concatBytes([
                  hostKey,
                  utf8Encode(record.identifier),
                  deviceKey
                ]),
                record.privateKey
              )
            ]
          ])
        )
      ]
    ])
  )
}
