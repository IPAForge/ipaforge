import { useTranslation } from 'react-i18next'

import { useFormat } from '@ui/hooks/use-format.ts'

type SkippedNoteProps = { names: readonly string[] }

/** The servers of SideStore's list left out because they aren't HTTPS, and that the user can add one themselves. */
export const SkippedNote = ({ names }: SkippedNoteProps) => {
  const { t } = useTranslation()
  const { list } = useFormat()
  if (names.length === 0) return null

  return (
    <p className="text-muted text-xs">
      {t('settings.anisette.skipped', { names: list(names) })}
    </p>
  )
}
