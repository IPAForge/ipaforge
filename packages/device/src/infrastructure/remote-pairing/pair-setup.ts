// Pair-setup over the remote pairing service: SRP (M1–M4) with the fixed USB PIN, or with the code an Apple TV or
// Vision Pro shows, then this computer's Ed25519 identity sent and the device's received under ChaCha20-Poly1305
// (M5–M6). The device's signature is checked, and its public key kept for every later pair-verify.
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
import type { HostIdentity } from '@device/domain/remote-pairing/types.ts'
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
import type {
  PairSetupResult,
  PeerInfo
} from '@device/infrastructure/remote-pairing/types.ts'
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
  /**
   * Pairing by code (an Apple TV or Vision Pro): asked once the device answered M1 and shows its code. A device
   * that asks the user to allow it instead is refused: only the code proves it's the one whose screen the user
   * sees. Without it, the fixed PIN is used.
   */
  readonly askPin?: () => Promise<string>
}

/** TLV8 error numbers (HomeKit's) that mean something to whoever typed the code. */
const TlvError = { Authentication: 2, Backoff: 3, MaxTries: 5 } as const

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
const deviceAltIrk = (info: Readonly<Record<string, unknown>>): Uint8Array => {
  const { altIRK } = info
  if (altIRK instanceof Uint8Array && altIRK.byteLength === ALT_IRK_BYTES)
    return altIRK
  throw failed('the device sent no identity resolving key')
}

const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const peerOf = (info: Readonly<Record<string, unknown>>): PeerInfo => {
  const udid = textOf(info.remotepairing_udid)
  const name = textOf(info.name)
  const model = textOf(info.model)

  return {
    ...(udid ? { udid } : {}),
    ...(name ? { name } : {}),
    ...(model ? { model } : {})
  }
}

/** A refusal while the code is checked, as the error the person typing it can act on. */
const asCodeError = (error: unknown): unknown => {
  if (!(error instanceof IPAForgeError)) return error
  if (error.code !== ErrorCode.PairingDenied) return error
  const { tlvError, retryDelay } = error.data as {
    tlvError?: number
    retryDelay?: number
  }
  if (tlvError === TlvError.Authentication)
    return new IPAForgeError(ErrorCode.PairingCodeWrong, { cause: error })
  if (tlvError === TlvError.Backoff || tlvError === TlvError.MaxTries)
    return new IPAForgeError(ErrorCode.PairingBackoff, {
      cause: error,
      ...(retryDelay === undefined ? {} : { data: { seconds: retryDelay } })
    })
  return error
}

export const pairSetup = async (
  channel: PairingChannel,
  options: PairSetupOptions
): Promise<PairSetupResult> => {
  const { host, askPin } = options
  let consentAsked = false
  const exchangeOptions: ExchangeOptions = {
    onAwaitingConsent: () => {
      consentAsked = true
      options.onAwaitingConsent?.()
    }
  }
  const step = (data: Uint8Array, startNewSession = false) =>
    exchange(
      channel,
      {
        data,
        kind: PairingKind.Setup,
        startNewSession,
        sendingHost: host.name
      },
      exchangeOptions
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
  // The device shows its code now. Pairing by code never falls back to the fixed PIN: without the code, nothing
  // proves this is the device whose screen the user sees.
  const byCode = askPin !== undefined
  if (byCode && consentAsked)
    throw failed('the device asked to be allowed instead of showing a code')
  const pin = byCode ? await askPin() : USB_PIN
  const srp = createSrpClient(SRP_USER, pin, options.randomBytes)
  const { proof, sessionKey } = srp.respond(
    requireTlv(m2, TlvType.Salt, 'salt'),
    requireTlv(m2, TlvType.PublicKey, 'SRP public key')
  )
  // M3 → M4: the proofs. A wrong one means the PIN (the code typed) or the SRP variant differs.
  const m4 = await step(
    encodeTlv8([
      [TlvType.State, state(3)],
      [TlvType.PublicKey, srp.publicKey],
      [TlvType.Proof, proof]
    ])
  ).catch((error: unknown) => {
    throw byCode ? asCodeError(error) : error
  })
  if (!srp.verify(requireTlv(m4, TlvType.Proof, 'SRP proof'))) {
    if (byCode) throw new IPAForgeError(ErrorCode.PairingCodeWrong)
    throw failed("the device's SRP proof doesn't match")
  }

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

  const infoBytes = device.get(TlvType.Info)
  const decoded = infoBytes ? decodeOpack(infoBytes) : undefined
  const info = isRecord(decoded) ? decoded : {}

  return {
    record: {
      identifier: host.identifier,
      publicKey: host.publicKey,
      privateKey: host.privateKey,
      deviceIdentifier: utf8Decode(deviceIdentifier),
      devicePublicKey,
      altIrk: deviceAltIrk(info)
    },
    peer: peerOf(info)
  }
}
