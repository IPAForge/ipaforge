import type { AppRunState, ExpiryTone } from '@ui/features/apps/types.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/** The dot's colour for each expiry tone. */
export const expiryDotClasses = {
  ok: 'bg-success',
  soon: 'bg-warning',
  expired: 'bg-danger',
  unknown: 'bg-muted'
} as const satisfies Record<ExpiryTone, string>

/** The words' colour for each expiry tone: the darker text shades, which keep WCAG AA contrast on a card. */
export const expiryTextClasses = {
  ok: 'text-success-soft-foreground',
  soon: 'text-warning-soft-foreground',
  expired: 'text-danger',
  unknown: 'text-muted'
} as const satisfies Record<ExpiryTone, string>

/** The mutation that asks the Engine how to refresh apps: shared, so every Refresh button knows it's under way. */
export const REFRESH_PLAN_KEY = ['refreshPlan'] as const

/** A row's line while its app waits in a refresh: asking Apple first, its turn, or done. */
export const appRunLineKeys = {
  checking: 'apps.run.checking',
  waiting: 'apps.run.waiting',
  done: 'apps.run.done'
} as const satisfies Record<
  Exclude<AppRunState['kind'], 'running'>,
  TranslationKey
>

/** The tag for an app's classic pairing file, by whose it is. */
export const classicPairingTags = {
  'this-computer': {
    labelKey: 'apps.pairing.classic.thisComputer',
    tone: 'ok'
  },
  'other-computer': {
    labelKey: 'apps.pairing.classic.otherComputer',
    tone: 'warn'
  },
  missing: { labelKey: 'apps.pairing.classic.missing', tone: 'bad' }
} as const

/** The tag for an app's remote pairing file (iOS 17.4 and later). */
export const remotePairingTags = {
  accepted: { labelKey: 'apps.pairing.remote.accepted', tone: 'ok' },
  rejected: { labelKey: 'apps.pairing.remote.rejected', tone: 'bad' },
  'other-computer': {
    labelKey: 'apps.pairing.remote.otherComputer',
    tone: 'warn'
  },
  missing: { labelKey: 'apps.pairing.remote.missing', tone: 'bad' }
} as const

/** Where an app's pairing file goes when its instructions don't say: where most tools look. */
export const DEFAULT_PAIRING_PATH = 'Documents/pairingFile.plist'

/** The Place button of an app in Pairing files, and its name for screen readers. */
export const pairingPlaceKeys = {
  place: { label: 'apps.pairing.place', one: 'apps.pairing.placeOne' },
  again: {
    label: 'apps.pairing.placeAgain',
    one: 'apps.pairing.placeAgainOne'
  },
  add: { label: 'apps.pairing.add', one: 'apps.pairing.addOne' }
} as const

/** The Pairing files dialog's first step: the list of apps. */
export const PAIRING_LIST = { kind: 'list' } as const
