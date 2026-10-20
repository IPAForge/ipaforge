/** What a note is about, as a changelog groups it. */
export type NoteKind = 'new' | 'changed' | 'fixed' | 'removed'

/** One change, said plainly; a new feature leads with its name in bold. */
export type ReleaseNoteItem = {
  readonly kind: NoteKind
  readonly title?: string
  readonly text: string
}

/** A version's notes, in English (they are not translated). */
export type ReleaseNotes = {
  readonly version: string
  /** When it was released, `YYYY-MM-DD`. */
  readonly date: string
  /** The version in one sentence. */
  readonly lead: string
  readonly items: readonly ReleaseNoteItem[]
}

/** What decides whether What's new opens by itself. */
export type WhatsNewCheck = {
  readonly hasNotes: boolean
  /** The version whose notes were last shown, if any. */
  readonly seen: string | undefined
  readonly version: string
  /** Nothing was ever picked in the top bar: a new install, not an update. */
  readonly isFirstLaunch: boolean
}
