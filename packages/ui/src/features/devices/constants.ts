import { ErrorCode } from '@ipaforge/kernel'
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
  // The darker text shade: plain success green misses WCAG AA contrast on a card.
  ready: 'text-success-soft-foreground',
  locked: 'text-warning-soft-foreground',
  developerModeOff: 'text-warning-soft-foreground',
  notTrusted: 'text-danger-soft-foreground',
  unavailable: 'text-danger-soft-foreground',
  notConnected: 'text-muted'
} as const satisfies Record<DeviceState, string>

/** The tints of a notice: the box itself and its title. */
export const noticeToneClasses = {
  warning: { box: 'bg-warning-soft', title: 'text-warning-soft-foreground' },
  danger: { box: 'bg-danger-soft', title: 'text-danger-soft-foreground' }
} as const

/** How long a note stays: long enough to read, short enough not to pile up while a cable is wiggled. */
export const NOTE_TIMEOUT_MS = 3000

/**
 * How long a connection change must last to be noted. A Wi-Fi device drops off and comes back as its screen
 * locks and wakes; a change undone within this time is not worth a note.
 */
export const SETTLE_MS = 4000

/**
 * Apple's model identifiers (lockdownd's `ProductType`) and the names people know them by. Proper names, so not
 * translated. A model missing here shows its identifier; add new ones as Apple releases them.
 */
export const modelNames: Readonly<Record<string, string>> = {
  'iPhone10,1': 'iPhone 8',
  'iPhone10,4': 'iPhone 8',
  'iPhone10,2': 'iPhone 8 Plus',
  'iPhone10,5': 'iPhone 8 Plus',
  'iPhone10,3': 'iPhone X',
  'iPhone10,6': 'iPhone X',
  'iPhone11,2': 'iPhone XS',
  'iPhone11,4': 'iPhone XS Max',
  'iPhone11,6': 'iPhone XS Max',
  'iPhone11,8': 'iPhone XR',
  'iPhone12,1': 'iPhone 11',
  'iPhone12,3': 'iPhone 11 Pro',
  'iPhone12,5': 'iPhone 11 Pro Max',
  'iPhone12,8': 'iPhone SE (2nd generation)',
  'iPhone13,1': 'iPhone 12 mini',
  'iPhone13,2': 'iPhone 12',
  'iPhone13,3': 'iPhone 12 Pro',
  'iPhone13,4': 'iPhone 12 Pro Max',
  'iPhone14,4': 'iPhone 13 mini',
  'iPhone14,5': 'iPhone 13',
  'iPhone14,2': 'iPhone 13 Pro',
  'iPhone14,3': 'iPhone 13 Pro Max',
  'iPhone14,6': 'iPhone SE (3rd generation)',
  'iPhone14,7': 'iPhone 14',
  'iPhone14,8': 'iPhone 14 Plus',
  'iPhone15,2': 'iPhone 14 Pro',
  'iPhone15,3': 'iPhone 14 Pro Max',
  'iPhone15,4': 'iPhone 15',
  'iPhone15,5': 'iPhone 15 Plus',
  'iPhone16,1': 'iPhone 15 Pro',
  'iPhone16,2': 'iPhone 15 Pro Max',
  'iPhone17,3': 'iPhone 16',
  'iPhone17,4': 'iPhone 16 Plus',
  'iPhone17,1': 'iPhone 16 Pro',
  'iPhone17,2': 'iPhone 16 Pro Max',
  'iPhone17,5': 'iPhone 16e',
  'iPhone18,3': 'iPhone 17',
  'iPhone18,1': 'iPhone 17 Pro',
  'iPhone18,2': 'iPhone 17 Pro Max',
  'iPhone18,4': 'iPhone Air',
  'iPad7,11': 'iPad (7th generation)',
  'iPad7,12': 'iPad (7th generation)',
  'iPad11,6': 'iPad (8th generation)',
  'iPad11,7': 'iPad (8th generation)',
  'iPad12,1': 'iPad (9th generation)',
  'iPad12,2': 'iPad (9th generation)',
  'iPad13,18': 'iPad (10th generation)',
  'iPad13,19': 'iPad (10th generation)',
  'iPad15,7': 'iPad (A16)',
  'iPad15,8': 'iPad (A16)',
  'iPad11,1': 'iPad mini (5th generation)',
  'iPad11,2': 'iPad mini (5th generation)',
  'iPad14,1': 'iPad mini (6th generation)',
  'iPad14,2': 'iPad mini (6th generation)',
  'iPad16,1': 'iPad mini (A17 Pro)',
  'iPad16,2': 'iPad mini (A17 Pro)',
  'iPad11,3': 'iPad Air (3rd generation)',
  'iPad11,4': 'iPad Air (3rd generation)',
  'iPad13,1': 'iPad Air (4th generation)',
  'iPad13,2': 'iPad Air (4th generation)',
  'iPad13,16': 'iPad Air (5th generation)',
  'iPad13,17': 'iPad Air (5th generation)',
  'iPad14,8': 'iPad Air 11-inch (M2)',
  'iPad14,9': 'iPad Air 11-inch (M2)',
  'iPad14,10': 'iPad Air 13-inch (M2)',
  'iPad14,11': 'iPad Air 13-inch (M2)',
  'iPad15,3': 'iPad Air 11-inch (M3)',
  'iPad15,4': 'iPad Air 11-inch (M3)',
  'iPad15,5': 'iPad Air 13-inch (M3)',
  'iPad15,6': 'iPad Air 13-inch (M3)',
  'iPad13,4': 'iPad Pro 11-inch (3rd generation)',
  'iPad13,5': 'iPad Pro 11-inch (3rd generation)',
  'iPad13,6': 'iPad Pro 11-inch (3rd generation)',
  'iPad13,7': 'iPad Pro 11-inch (3rd generation)',
  'iPad13,8': 'iPad Pro 12.9-inch (5th generation)',
  'iPad13,9': 'iPad Pro 12.9-inch (5th generation)',
  'iPad13,10': 'iPad Pro 12.9-inch (5th generation)',
  'iPad13,11': 'iPad Pro 12.9-inch (5th generation)',
  'iPad14,3': 'iPad Pro 11-inch (4th generation)',
  'iPad14,4': 'iPad Pro 11-inch (4th generation)',
  'iPad14,5': 'iPad Pro 12.9-inch (6th generation)',
  'iPad14,6': 'iPad Pro 12.9-inch (6th generation)',
  'iPad16,3': 'iPad Pro 11-inch (M4)',
  'iPad16,4': 'iPad Pro 11-inch (M4)',
  'iPad16,5': 'iPad Pro 13-inch (M4)',
  'iPad16,6': 'iPad Pro 13-inch (M4)'
}

/** macOS System Settings › Privacy & Security › Local Network. */
export const LOCAL_NETWORK_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_LocalNetwork'
