// The bodies remote pairing sends and reads: the handshake request, pairing data events (TLV8 in base64), and what
// the device answers with (its handshake reply, pairing data, a consent prompt, or a rejection with its reason).
import { WIRE_PROTOCOL_VERSION } from '@device/domain/remote-pairing/constants.ts'
import { isRecord, valueAt } from '@device/domain/remote-pairing/json.ts'
import type {
  DeviceMessage,
  PairingDataInput
} from '@device/domain/remote-pairing/types.ts'
import { fromBase64, toBase64 } from '@ipaforge/kernel'

export const handshakeRequest = () => ({
  request: {
    _0: {
      handshake: {
        _0: {
          hostOptions: { attemptPairVerify: true },
          wireProtocolVersion: WIRE_PROTOCOL_VERSION
        }
      }
    }
  }
})

export const pairingDataEvent = (input: PairingDataInput) => ({
  event: {
    _0: {
      pairingData: {
        _0: {
          data: toBase64(input.data),
          kind: input.kind,
          sendingHost: input.sendingHost,
          startNewSession: input.startNewSession
        }
      }
    }
  }
})

const UNKNOWN_REASON = 'the device refused to pair'

export const readDeviceMessage = (
  body: Record<string, unknown>
): DeviceMessage => {
  if (isRecord(valueAt(body, ['response', '_1', 'handshake'])))
    return { kind: 'handshake' }
  const event = valueAt(body, ['event', '_0'])
  const data = valueAt(event, ['pairingData', '_0', 'data'])
  if (typeof data === 'string')
    return { kind: 'pairing-data', data: fromBase64(data) }
  if (isRecord(event) && 'awaitingUserConsent' in event)
    return { kind: 'awaiting-consent' }
  if (isRecord(event) && 'pairingRejectedWithError' in event) {
    const reason = valueAt(event, [
      'pairingRejectedWithError',
      '_0',
      'wrappedError',
      'userInfo',
      'NSLocalizedDescription'
    ])

    return {
      kind: 'rejected',
      reason: typeof reason === 'string' ? reason : UNKNOWN_REASON
    }
  }
  return { kind: 'other' }
}
