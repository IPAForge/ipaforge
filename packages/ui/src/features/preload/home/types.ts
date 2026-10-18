import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { InstallPlan, Team } from '@ui/services/engine/types.ts'
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
