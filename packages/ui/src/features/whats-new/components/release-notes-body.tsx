import { NoteSection } from '@ui/features/whats-new/components/note-section.tsx'
import { NOTE_KINDS } from '@ui/features/whats-new/constants.ts'
import type { ReleaseNotes } from '@ui/features/whats-new/types.ts'

type ReleaseNotesBodyProps = { notes: ReleaseNotes }

/** A version's notes in sections, New, Changed, Fixed and Removed, each one left out when empty. */
export const ReleaseNotesBody = ({ notes }: ReleaseNotesBodyProps) => (
  <div className="flex flex-col gap-3">
    {NOTE_KINDS.map((kind) => {
      const items = notes.items.filter((item) => item.kind === kind)

      return items.length > 0 ? (
        <NoteSection key={kind} kind={kind} items={items} />
      ) : null
    })}
  </div>
)
