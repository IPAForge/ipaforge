import { useTranslation } from 'react-i18next'

import type { ReleaseNotes } from '@ui/features/whats-new/types.ts'
import { releaseDate } from '@ui/features/whats-new/utils/release-date.ts'
import { useFormat } from '@ui/hooks/use-format.ts'

type VersionLineProps = { notes: ReleaseNotes }

/** "Version 0.1.0-alpha.4 · 20 Oct 2026" */
export const VersionLine = ({ notes }: VersionLineProps) => {
  const { t } = useTranslation()
  const { date } = useFormat()

  return (
    <p className="text-muted text-sm tabular-nums">
      {t('whatsNew.version', {
        version: notes.version,
        date: date(releaseDate(notes.date))
      })}
    </p>
  )
}
