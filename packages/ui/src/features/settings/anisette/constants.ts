import type { AnisetteServerEntry } from '@ui/services/engine/types.ts'

/** The id of the Anisette servers card: "Choose another anisette server" opens Settings at it. */
export const ANISETTE_CARD_ID = 'anisette'

/** The list's groups, in the order Automatic tries them. */
export const serverSources = [
  'custom',
  'list',
  'backup'
] as const satisfies readonly AnisetteServerEntry['source'][]

/** Each group's heading. */
export const groupLabelKeys = {
  custom: 'settings.anisette.group.custom',
  list: 'settings.anisette.group.list',
  backup: 'settings.anisette.group.backup'
} as const satisfies Record<AnisetteServerEntry['source'], string>

/** The two ways of picking a server, as the switch shows them. */
export const anisetteModes = ['automatic', 'chosen'] as const

/** What each mode means, next to the switch (Choose a server, with none chosen yet). */
export const modeHintKeys = {
  automatic: 'settings.anisette.modeHint.automatic',
  chosen: 'settings.anisette.modeHint.none'
} as const

/** A server's place, or its radio, beside its name. */
export const LEAD_CLASS =
  'grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-3'

/** A tag next to a server's name. */
export const TAG_CLASS = 'whitespace-nowrap rounded-full px-2 py-0.5 text-xs'

/** Each mode's label in the switch. */
export const modeLabelKeys = {
  automatic: 'settings.anisette.mode.automatic',
  chosen: 'settings.anisette.mode.chosen'
} as const

/** A test's status: its dot's colour and its text's colour. */
export const statusClasses = {
  untested: { dot: 'bg-surface-tertiary', text: 'text-muted' },
  testing: { dot: '', text: 'text-muted' },
  ok: { dot: 'bg-success', text: 'text-success' },
  bad: { dot: 'bg-danger', text: 'text-danger-soft-foreground' }
} as const

/** How long the card stays outlined after "Choose another anisette server" opened it. */
export const HIGHLIGHT_MS = 1600
