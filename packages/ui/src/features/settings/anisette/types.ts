import type { AnisetteServerEntry } from '@ui/services/engine/types.ts'

/** A server's last test in this window: running, answered (how fast), or no answer. */
export type ServerTestState =
  | { readonly phase: 'testing' }
  | { readonly phase: 'ok'; readonly latencyMs: number }
  | { readonly phase: 'bad' }

/** The tests run so far, by address, and how to run one or all. */
export type ServerTests = {
  readonly states: Readonly<Record<string, ServerTestState>>
  test(address: string): void
  testAll(addresses: readonly string[]): void
  /** Records a result the Add server dialog already has. */
  record(address: string, state: ServerTestState): void
}

/** The list's groups, in the order Automatic tries them. */
export type ServerGroup = {
  readonly source: AnisetteServerEntry['source']
  readonly servers: readonly AnisetteServerEntry[]
}

/** What the Add or Edit server dialog edits: nothing for a new one, else the server being edited. */
export type ServerDialogTarget =
  | { readonly mode: 'add' }
  | { readonly mode: 'edit'; readonly server: AnisetteServerEntry }

/** Why the typed server can't be saved, as a translation key per field. */
export type ServerFormProblems = {
  readonly name?: 'settings.anisette.dialog.nameMissing'
  readonly address?:
    | 'settings.anisette.dialog.addressInvalid'
    | 'settings.anisette.dialog.exists'
}
