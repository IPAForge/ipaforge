import { RELEASE_NOTES } from '@ui/features/whats-new/constants.ts'
import type { ReleaseNotes } from '@ui/features/whats-new/types.ts'

/** A version's notes, if it has any (a development build has none). */
export const notesFor = (version: string): ReleaseNotes | undefined =>
  RELEASE_NOTES.find((notes) => notes.version === version)
