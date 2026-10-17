import { ErrorCode } from '@loadstar/kernel'
import type { StatusTone } from '@ui/components/shell/types.ts'
import type { DeviceState } from '@ui/features/devices/types.ts'

/** The device has not paired with this computer, or the pairing went stale: the user taps Trust. */
export const UNTRUSTED: ReadonlySet<string> = new Set([
  ErrorCode.DeviceNotPaired,
  ErrorCode.PairingPending,
  ErrorCode.PairingDenied,
  ErrorCode.InvalidPairRecord
])

export const deviceTone = {
  checking: 'off',
  ready: 'ready',
  locked: 'warning',
  developerModeOff: 'warning',
  notTrusted: 'danger',
  unavailable: 'danger',
  notConnected: 'off'
} as const satisfies Record<DeviceState, StatusTone>

/** The state's words on a device card, in its tone's colour. */
export const deviceStateClasses = {
  checking: 'text-muted',
  ready: 'text-success',
  locked: 'text-warning',
  developerModeOff: 'text-warning',
  notTrusted: 'text-danger',
  unavailable: 'text-danger',
  notConnected: 'text-muted'
} as const satisfies Record<DeviceState, string>

/** The tints of a notice: the box itself and its title. */
export const noticeToneClasses = {
  warning: { box: 'bg-warning-soft', title: 'text-warning' },
  danger: { box: 'bg-danger-soft', title: 'text-danger' }
} as const

/** How long a note stays: long enough to read, short enough not to pile up while a cable is wiggled. */
export const NOTE_TIMEOUT_MS = 3000

/**
 * How long a connection change must last to be noted. A Wi-Fi device drops off and comes back as its screen
 * locks and wakes; a change undone within this time is not worth a note.
 */
export const SETTLE_MS = 4000
