import type { AnisetteServer } from '@apple/domain/types.ts'

export type FetchedList = {
  readonly servers: AnisetteServer[]
  readonly fetchedAt: number
  /** Names of the list's servers left out because they are not HTTPS. */
  readonly skipped: readonly string[]
}

export type RemoteServerList = {
  /** The remote list, fetched again when older than `anisetteServerListMaxAgeMs`; the last known one otherwise. */
  current(): Promise<AnisetteServer[]>
  /** The last list fetched (as `current` keeps it up to date), with when and what was left out; none yet: undefined. */
  snapshot(): Promise<FetchedList | undefined>
  /** Fetches the list now, whatever its age; the last known one stays when that fails. */
  update(): Promise<FetchedList | undefined>
}

/**
 * How IPAForge picks an anisette server: by itself (`automatic`: the servers in order, moving on when one fails),
 * or always the one the user chose. Choosing without a server yet still picks by itself.
 */
export type AnisetteChoice =
  | { readonly mode: 'automatic' }
  | { readonly mode: 'chosen'; readonly server?: AnisetteServer }

/** What the user set: the choice, and the servers they added (newest first). */
export type AnisetteSettings = {
  readonly choice: AnisetteChoice
  readonly custom: readonly AnisetteServer[]
}

/** Where a server comes from: added by the user, SideStore's list, or IPAForge's built-in backup. */
export type AnisetteServerSource = 'custom' | 'list' | 'backup'

export type AnisetteServerEntry = AnisetteServer & {
  readonly source: AnisetteServerSource
}

/** The anisette servers as Settings shows them, in the order Automatic tries them. */
export type AnisetteOverview = {
  readonly servers: readonly AnisetteServerEntry[]
  readonly choice: AnisetteChoice
  /** The address of the server that worked last (Automatic tries it right after the ones the user added). */
  readonly lastUsed?: string
  /** When SideStore's list was last fetched (ms since the epoch); never: absent. */
  readonly listUpdatedAt?: number
  /** Names of the list's servers left out because they are not HTTPS. */
  readonly skipped: readonly string[]
}

/** A server the user adds or edits. */
export type AnisetteServerInput = {
  readonly name: string
  readonly address: string
}

/** One server's test: whether it answered, and how fast. */
export type AnisetteServerTest = {
  readonly address: string
  readonly ok: boolean
  readonly latencyMs?: number
}

export type AnisetteSettingsStore = {
  load(): Promise<AnisetteSettings>
  save(settings: AnisetteSettings): Promise<void>
}
