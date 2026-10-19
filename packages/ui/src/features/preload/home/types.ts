import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type {
  CatalogApp,
  InstallPlan,
  SourceApp,
  SourceApps,
  Team
} from '@ui/services/engine/types.ts'
import type { PreloadItem } from '@ui/state/preload/types.ts'

/** Where an app in the list is: waiting for the device and Apple ID, being read, ready, or unable to install. */
export type RowStatus =
  | 'waiting'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'problem'

/** Why an app can't be installed: the device's iOS is too old, or a message (with what to do) by key. */
export type RowProblem =
  | { readonly kind: 'needs-ios'; readonly needs: string; readonly has: string }
  | {
      readonly kind: 'message'
      readonly key: TranslationKey
      readonly detailKey?: TranslationKey | undefined
    }

/** An app of the list with what the Engine said about it. */
export type PreloadRow = {
  readonly item: PreloadItem
  readonly status: RowStatus
  readonly plan?: InstallPlan | undefined
  readonly problem?: RowProblem | undefined
}

/** The apps that can be installed, added up against the account's limits. */
export type PreloadTotals = {
  readonly apps: number
  /** App IDs the apps need that the team doesn't have yet. */
  readonly newAppIds: number
  /** App IDs left this week (free teams); undefined for a team without a limit. */
  readonly available: number | undefined
  readonly enough: boolean
  readonly nextSlotAt: Date | undefined
  /** Free-app slots: used now, after this install, and the limit; undefined for a paid team. */
  readonly freeApps:
    | { readonly used: number; readonly after: number; readonly limit: number }
    | undefined
  readonly certificateReused: boolean
  readonly team: Team | undefined
}

/** An app in Browse apps: from the catalog or an app source, listed once even when several sources have it. */
export type BrowseEntry = {
  /** Unique in the list: the source and the app. */
  readonly key: string
  readonly name: string
  readonly bundleId: string
  readonly sourceId: string
  readonly sourceName: string
  readonly builtin: boolean
  /** Other sources (shown) that list the same app. */
  readonly also: readonly string[]
  readonly catalogApp?: CatalogApp | undefined
  readonly sourceApp?: SourceApp | undefined
}

/** What Browse apps is built from: the catalog (when it's on) and each AltStore-format source that's on. */
export type BrowseInput = {
  readonly catalogApps: readonly CatalogApp[]
  /** Undefined when the catalog source is off. */
  readonly catalogName: string | undefined
  readonly sources: readonly SourceApps[]
  /** A source id, or `undefined` for every source. */
  readonly filter: string | undefined
  readonly query: string
}

/** The Preload page's two tabs. */
export type PreloadTab = 'apps' | 'sources'
