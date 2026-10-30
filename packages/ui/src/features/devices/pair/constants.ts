import type { DeviceKind } from '@ui/features/devices/types.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/** Apple TV and Vision Pro show 6 digits; the Engine's question says so too. */
export const PAIRING_CODE_LENGTH = 6

/** How often the wait after too many wrong codes counts down. */
export const COUNTDOWN_TICK_MS = 1000

/** Where each kind of device opens its pairing screen, and what it's called there. */
export const pairingScreens = [
  {
    kind: 'tv',
    nameKey: 'pairByCode.where.tv',
    pathKey: 'pairByCode.where.tvPath'
  },
  {
    kind: 'vision',
    nameKey: 'pairByCode.where.vision',
    pathKey: 'pairByCode.where.visionPath'
  }
] as const satisfies readonly {
  kind: DeviceKind
  nameKey: TranslationKey
  pathKey: TranslationKey
}[]

/** The help under "It doesn't show up", in order. */
export const notFoundHelpKeys = [
  'pairByCode.help.screen',
  'pairByCode.help.network',
  'pairByCode.help.ipv6',
  'pairByCode.help.macos',
  'pairByCode.help.windows'
] as const satisfies readonly TranslationKey[]

/** The two steps the dialog's header names, the current one filled in. */
export const progressClasses = {
  current: 'rounded-full bg-accent px-2.5 py-0.5 text-accent-foreground',
  other: 'rounded-full bg-surface-secondary px-2.5 py-0.5 text-muted'
} as const
