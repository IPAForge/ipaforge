// What a device's status query says about it, as the device picker, the Devices page and the Install page show it.
import { ErrorCode, toLoadstarError } from '@loadstar/kernel'
import type { StatusTone } from '@ui/components/shell/status-dot.tsx'
import type { DeviceCheck } from '@ui/services/engine/engine-types.ts'

export type DeviceState =
  | 'checking'
  | 'ready'
  | 'locked'
  | 'developerModeOff'
  | 'notTrusted'
  | 'unavailable'
  | 'notConnected'

/** The device has not paired with this computer, or the pairing went stale: the user taps Trust. */
const UNTRUSTED: ReadonlySet<string> = new Set([
  ErrorCode.DeviceNotPaired,
  ErrorCode.PairingPending,
  ErrorCode.PairingDenied,
  ErrorCode.InvalidPairRecord
])

export type StatusQuery = {
  readonly data?: DeviceCheck | undefined
  readonly error?: unknown
  readonly isFetching: boolean
}

/** The state the last read saw; while a read is under way, "checking". */
export const deviceState = (
  { data, error, isFetching }: StatusQuery,
  isConnected: boolean
): DeviceState => {
  if (!isConnected) return 'notConnected'
  if (isFetching || (!data && !error)) return 'checking'
  if (error)
    return UNTRUSTED.has(toLoadstarError(error).code)
      ? 'notTrusted'
      : 'unavailable'
  if (!data) return 'checking'
  if (data.locked) return 'locked'
  if (data.developerMode === 'off') return 'developerModeOff'
  return 'ready'
}

export const deviceTone = {
  checking: 'off',
  ready: 'ready',
  locked: 'warning',
  developerModeOff: 'warning',
  notTrusted: 'danger',
  unavailable: 'danger',
  notConnected: 'off'
} as const satisfies Record<DeviceState, StatusTone>
