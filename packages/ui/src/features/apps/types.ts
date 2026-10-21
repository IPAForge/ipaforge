import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type {
  AppPairing,
  AppSource,
  InstalledApp
} from '@ui/services/engine/types.ts'
import type { RefreshKind } from '@ui/state/active-run/types.ts'

/** How close an app is to expiring: fine, inside the refresh window, expired, or unknown (no profile seen). */
export type ExpiryTone = 'ok' | 'soon' | 'expired' | 'unknown'

/** A newer version of an installed app in one of the sources. */
export type AppUpdate = {
  readonly version: string
  readonly downloadUrl: string
  /** The installed app's original bundle id: the download must be that app. */
  readonly replaces: string
}

/** An installed app as the Apps page shows it. */
export type AppView = {
  readonly app: InstalledApp
  /** Days until it expires (negative once expired); undefined without a profile. */
  readonly daysLeft: number | undefined
  /** The days shown: calendar days until it expires, as SideStore counts them (`calendarDaysLeft`). */
  readonly daysShown: number | undefined
  readonly tone: ExpiryTone
  /** Where it came from, in words. */
  readonly from: string | undefined
  readonly update: AppUpdate | undefined
  /** How Refresh would install it again; undefined when it can't here (an .ipa from another computer). */
  readonly refresh: RefreshPlan | undefined
}

/**
 * How an app is refreshed: from the copy this computer kept, or installed again from where it came from (its
 * catalog app or source link; same bundle id and team, so it keeps its data).
 */
export type RefreshPlan =
  | { readonly kind: 'kept' }
  /** Marked by IPAForge elsewhere with nothing to install it from: a new profile only, if its certificate holds. */
  | { readonly kind: 'profile' }
  | {
      readonly kind: 'source'
      readonly source: AppSource
      readonly from: string
      /** Every source that lists it, this one first, when there's more than one to pick from. */
      readonly choices?: readonly SourceChoice[]
    }

/** A source an app can be installed again from: where, its name, and the version it would install. */
export type SourceChoice = {
  readonly source: AppSource
  readonly from: string
  readonly version: string
}

/** Where an app is in a run started from the Apps page. */
export type AppRunState =
  /** Refresh asks Apple first which apps need only a new profile. */
  | { readonly kind: 'checking' }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'done' }
  | {
      readonly kind: 'running'
      readonly labelKey: TranslationKey
      /** 0–1, within the app's own steps. */
      readonly fraction: number
    }

/** A refresh's apps: installed again (and why, when the Engine said), and those that only get new profiles. */
export type RefreshBatch = {
  readonly reinstall: readonly {
    readonly view: AppView
    readonly refresh: RefreshKind | undefined
  }[]
  readonly profiles: readonly AppView[]
}

/** What the Pairing files dialog shows: the list, or one step about an app (or SideStore's remote pairing). */
export type PairingStep =
  | { readonly kind: 'list' }
  | { readonly kind: 'add'; readonly app: AppPairing }
  | { readonly kind: 'remove'; readonly app: AppPairing }
  | { readonly kind: 'newRemote' }
