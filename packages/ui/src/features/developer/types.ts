import type { TeamQuery } from '@ipaforge/rpc'
import type {
  certificateMakerKeys,
  portalTabs,
  tagClasses
} from '@ui/features/developer/constants.ts'
import type { usePortalData } from '@ui/features/developer/hooks/use-portal-data.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { Account, InstalledApp, Team } from '@ui/services/engine/types.ts'

export type PortalTab = (typeof portalTabs)[number]

export type TagTone = keyof typeof tagClasses

/** A tag beside a row's name. */
export type RowTag = {
  readonly labelKey: TranslationKey
  readonly values?: Readonly<Record<string, string | number>>
  readonly tone: TagTone
}

/** What the page shows things for: the Apple ID in use, its chosen team, and the device in use. */
export type PortalContext = {
  readonly account: Account | undefined
  readonly teams: readonly Team[]
  readonly team: Team | undefined
  readonly query: TeamQuery | undefined
  /** False while the Apple ID's session has to be renewed (Sign in again). */
  readonly canAsk: boolean
  readonly device: { readonly udid: string; readonly name: string } | undefined
  /** The apps on the device, for what each certificate, App ID and profile belongs to. */
  readonly apps: readonly InstalledApp[]
  readonly onTeam: (teamId: string) => void
}

export type CertificateMaker = keyof typeof certificateMakerKeys

/** A Developer Portal row ready to show: its title, tags, details and buttons. */
export type PortalRowView = {
  readonly id: string
  readonly title: string
  readonly tags: readonly RowTag[]
  /** The identifier (serial, bundle id, UDID), in a monospace face. */
  readonly code?: string
  readonly details: readonly string[]
}

/** What the page read: one query per tab. */
export type PortalData = ReturnType<typeof usePortalData>

/** A .p12 picked in the import dialog: its name to show, and its bytes. */
export type PickedFile = {
  readonly name: string
  readonly bytes: Uint8Array
}
