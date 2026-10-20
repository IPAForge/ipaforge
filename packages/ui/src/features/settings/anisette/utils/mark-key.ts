import type {
  AnisetteOverview,
  AnisetteServerEntry
} from '@ui/services/engine/types.ts'

/** "Chosen" for the server the user picked, "In use" for the one Automatic used last, else nothing. */
export const markKeyFor = (
  overview: AnisetteOverview,
  server: AnisetteServerEntry,
  isSelected: boolean
):
  | 'settings.anisette.tag.inUse'
  | 'settings.anisette.tag.chosen'
  | undefined => {
  if (overview.choice.mode === 'chosen')
    return isSelected ? 'settings.anisette.tag.chosen' : undefined

  return overview.lastUsed === server.address
    ? 'settings.anisette.tag.inUse'
    : undefined
}
