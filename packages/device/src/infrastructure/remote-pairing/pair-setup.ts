// Pair-setup over the remote pairing service: SRP with the fixed USB PIN (M1–M4), then this computer's Ed25519
// identity sent and the device's received under ChaCha20-Poly1305 (M5–M6). The device's signature is checked,
// and its public key kept for every later pair-verify.
import { ed25519 } from '@noble/curves/ed25519.js'

import {
  KeyDerivation,
  Nonce,
  PairingKind,
  SRP_USER,
  TlvType,
  USB_PIN
} from '@device/domain/remote-pairing/constants.ts'
import { isRecord } from '@device/domain/remote-pairing/json.ts'
import {
  decodeOpack,
  encodeOpack
} from '@device/domain/remote-pairing/opack.ts'
import { decodeTlv8, encodeTlv8 } from '@device/domain/remote-pairing/tlv8.ts'
import type {
  HostIdentity,
  RemotePairingRecord
} from '@device/domain/remote-pairing/types.ts'
import type { PairingChannel } from '@device/infrastructure/remote-pairing/channel.ts'
import {
  deriveKey,
  open,
  seal
} from '@device/infrastructure/remote-pairing/crypto.ts'
import {
  type ExchangeOptions,
  exchange,
  handshake,
  requireTlv
} from '@device/infrastructure/remote-pairing/exchange.ts'
import { createSrpClient } from '@device/infrastructure/remote-pairing/srp.ts'
import {
  concatBytes,
  ErrorCode,
  IPAForgeError,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'

const ALT_IRK_BYTES = 16

export type PairSetupOptions = ExchangeOptions & {
  readonly host: HostIdentity
  readonly randomBytes: (length: number) => Uint8Array
}

const state = (value: number) => new Uint8Array([value])

const failed = (message: string) =>
  new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: `remote pairing: ${message}`
  })

const hexMac = (mac: Uint8Array): string =>
  [...mac].map((byte) => byte.toString(16).padStart(2, '0')).join(':')

/** The info dictionary this computer sends in M5. */
const hostInfo = (host: HostIdentity) =>
  encodeOpack({
    accountID: host.identifier,
    altIRK: host.altIrk,
    btAddr: hexMac(host.mac),
    mac: host.mac,
    model: host.model,
    name: host.name,
    remotepairing_serial_number: host.serialNumber
  })

/** The device's identity resolving key from its M6 info dictionary. */
const deviceAltIrk = (info: Uint8Array | undefined): Uint8Array => {
  const value = info ? decodeOpack(info) : undefined
  const altIrk = isRecord(value) ? value.altIRK : undefined
  if (altIrk instanceof Uint8Array && altIrk.byteLength === ALT_IRK_BYTES)
    return altIrk
  throw failed('the device sent no identity resolving key')
}

export const pairSetup = async (
  channel: PairingChannel,
  options: PairSetupOptions
): Promise<RemotePairingRecord> => {
  const { host } = options
  const step = (data: Uint8Array, startNewSession = false) =>
    exchange(
      channel,
      {
        data,
        kind: PairingKind.Setup,
        startNewSession,
        sendingHost: host.name
      },
      options
    )

  await handshake(channel)
  // M1 → M2: the device's salt and SRP public key.
  const m2 = await step(
    encodeTlv8([
      [TlvType.Method, new Uint8Array([0])],
      [TlvType.State, state(1)]
    ]),
    true
  )
  const srp = createSrpClient(SRP_USER, USB_PIN, options.randomBytes)
  const { proof, sessionKey } = srp.respond(
    requireTlv(m2, TlvType.Salt, 'salt'),
    requireTlv(m2, TlvType.PublicKey, 'SRP public key')
  )
  // M3 → M4: the proofs. A wrong one means the PIN or the SRP variant differs.
  const m4 = await step(
    encodeTlv8([
      [TlvType.State, state(3)],
      [TlvType.PublicKey, srp.publicKey],
      [TlvType.Proof, proof]
    ])
  )
  if (!srp.verify(requireTlv(m4, TlvType.Proof, 'SRP proof')))
    throw failed("the device's SRP proof doesn't match")

  // M5 → M6: identities, sealed with the SRP session key.
  const encryptKey = deriveKey(sessionKey, KeyDerivation.setupEncrypt)
  const hostSigned = concatBytes([
    deriveKey(sessionKey, KeyDerivation.controllerSign),
    utf8Encode(host.identifier),
    host.publicKey
  ])
  const m6 = await step(
    encodeTlv8([
      [TlvType.State, state(5)],
      [
        TlvType.EncryptedData,
        seal(
          encryptKey,
          Nonce.setupM5,
          encodeTlv8([
            [TlvType.Identifier, utf8Encode(host.identifier)],
            [TlvType.PublicKey, host.publicKey],
            [TlvType.Signature, ed25519.sign(hostSigned, host.privateKey)],
            [TlvType.Info, hostInfo(host)]
          ])
        )
      ]
    ])
  )
  let sealed: Uint8Array
  try {
    sealed = open(
      encryptKey,
      Nonce.setupM6,
      requireTlv(m6, TlvType.EncryptedData, 'identity')
    )
  } catch (error) {
    if (error instanceof IPAForgeError) throw error
    throw failed("the device's identity doesn't open with the session key")
  }
  const device = decodeTlv8(sealed)
  const deviceIdentifier = requireTlv(device, TlvType.Identifier, 'identifier')
  const devicePublicKey = requireTlv(device, TlvType.PublicKey, 'public key')
  const deviceSigned = concatBytes([
    deriveKey(sessionKey, KeyDerivation.accessorySign),
    deviceIdentifier,
    devicePublicKey
  ])
  if (
    !ed25519.verify(
      requireTlv(device, TlvType.Signature, 'signature'),
      deviceSigned,
      devicePublicKey
    )
  )
    throw failed("the device's signature doesn't match its identity")

  return {
    identifier: host.identifier,
    publicKey: host.publicKey,
    privateKey: host.privateKey,
    deviceIdentifier: utf8Decode(deviceIdentifier),
    devicePublicKey,
    altIrk: deviceAltIrk(device.get(TlvType.Info))
  }
}
