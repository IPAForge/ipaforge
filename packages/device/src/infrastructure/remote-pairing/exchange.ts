// Waiting for the device during pairing: the handshake reply, then each pairing data event. A rejection (with the
// device's reason) and an error record in the TLV8 end pairing; a consent prompt is passed on while it waits.
import { TlvType } from '@device/domain/remote-pairing/constants.ts'
import {
  handshakeRequest,
  pairingDataEvent,
  readDeviceMessage
} from '@device/domain/remote-pairing/messages.ts'
import { decodeTlv8 } from '@device/domain/remote-pairing/tlv8.ts'
import type {
  PairingDataInput,
  TlvMap
} from '@device/domain/remote-pairing/types.ts'
import type { PairingChannel } from '@device/infrastructure/remote-pairing/channel.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

/** How many unrelated messages may come between two steps before the device is taken to be stuck. */
const MAX_SKIPPED_MESSAGES = 32

export type ExchangeOptions = {
  /** The device shows a prompt (Trust this computer) and waits for the user. */
  readonly onAwaitingConsent?: () => void
}

/** A refusal; an error record's number (HomeKit's: 2 authentication, 3 back-off, 5 too many tries) and wait. */
const deviceRefused = (
  reason: string,
  record: { tlvError?: number; retryDelay?: number } = {}
) =>
  new IPAForgeError(ErrorCode.PairingDenied, {
    message: `remote pairing refused: ${reason}`,
    data: { reason, ...record }
  })

/** A little-endian unsigned number of up to 4 bytes (the TLV8 `RetryDelay`). */
const littleEndian = (bytes: Uint8Array): number =>
  bytes.subarray(0, 4).reduceRight((value, byte) => value * 256 + byte, 0)

export const handshake = async (channel: PairingChannel): Promise<void> => {
  await channel.send(handshakeRequest())
  for (let skipped = 0; skipped < MAX_SKIPPED_MESSAGES; skipped++) {
    const message = readDeviceMessage(await channel.receive())
    if (message.kind === 'handshake') return
    if (message.kind === 'rejected') throw deviceRefused(message.reason)
  }
  throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: 'remote pairing: no handshake reply'
  })
}

/** Sends one pairing data event and returns the device's next one, decoded; its error record ends pairing. */
export const exchange = async (
  channel: PairingChannel,
  input: PairingDataInput,
  options: ExchangeOptions = {}
): Promise<TlvMap> => {
  await channel.send(pairingDataEvent(input))
  for (let skipped = 0; skipped < MAX_SKIPPED_MESSAGES; skipped++) {
    const message = readDeviceMessage(await channel.receive())
    if (message.kind === 'awaiting-consent') options.onAwaitingConsent?.()
    if (message.kind === 'rejected') throw deviceRefused(message.reason)
    if (message.kind !== 'pairing-data') continue
    const tlv = decodeTlv8(message.data)
    const error = tlv.get(TlvType.Error)
    if (error) {
      const delay = tlv.get(TlvType.RetryDelay)
      throw deviceRefused(`TLV8 error ${error[0] ?? 'unknown'}`, {
        ...(error[0] === undefined ? {} : { tlvError: error[0] }),
        ...(delay ? { retryDelay: littleEndian(delay) } : {})
      })
    }
    return tlv
  }
  throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
    message: 'remote pairing: the device stopped answering the pairing steps'
  })
}

/** A record the step needs; missing means the device answered something else. */
export const requireTlv = (tlv: TlvMap, type: number, what: string) => {
  const value = tlv.get(type)
  if (!value)
    throw new IPAForgeError(ErrorCode.DeviceProtocolError, {
      message: `remote pairing: the device sent no ${what}`
    })
  return value
}
