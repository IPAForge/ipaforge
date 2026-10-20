import { useTranslation } from 'react-i18next'

import { noteKindDots, noteKindKeys } from '@ui/features/whats-new/constants.ts'
import type { NoteKind, ReleaseNoteItem } from '@ui/features/whats-new/types.ts'

type NoteSectionProps = {
  kind: NoteKind
  items: readonly ReleaseNoteItem[]
}

/** New, Changed, Fixed or Removed: its heading with a coloured dot, then its notes as a list. */
export const NoteSection = ({ kind, items }: NoteSectionProps) => {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="mt-1 flex items-center gap-2 font-medium text-muted text-xs uppercase tracking-wider">
        <span
          aria-hidden="true"
          className={`size-2 rounded-full ${noteKindDots[kind]}`}
        />
        {t(noteKindKeys[kind])}
      </h3>
      <ul className="flex list-disc flex-col gap-1.5 ps-[18px] text-sm leading-snug">
        {items.map((item) => (
          <li key={item.text}>
            {item.title ? (
              <strong className="font-semibold">{`${item.title}. `}</strong>
            ) : null}
            {item.text}
          </li>
        ))}
      </ul>
    </section>
  )
}
