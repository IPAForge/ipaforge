import { Button, Chip } from '@heroui/react'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ReleaseNotesBody } from '@ui/features/whats-new/components/release-notes-body.tsx'
import { RELEASES_URL } from '@ui/features/whats-new/constants.ts'
import type { ReleaseNotes } from '@ui/features/whats-new/types.ts'
import { releaseDate } from '@ui/features/whats-new/utils/release-date.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

type ReleaseArticleProps = {
  notes: ReleaseNotes
  isCurrent: boolean
}

/**
 * One version on the changelog: its number and date, the one IPAForge runs marked, its release on GitHub (the
 * downloads and the longer notes), then its notes.
 */
export const ReleaseArticle = ({ notes, isCurrent }: ReleaseArticleProps) => {
  const { t } = useTranslation()
  const { date } = useFormat()
  const { links } = useUiServices()
  const onRelease = () => links.open(`${RELEASES_URL}/tag/v${notes.version}`)

  return (
    <article className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3.5">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-semibold text-lg tabular-nums">{notes.version}</h2>
        <span className="text-muted text-sm">
          {date(releaseDate(notes.date))}
        </span>
        {isCurrent ? (
          <Chip size="sm" color="success">
            {t('whatsNew.page.current')}
          </Chip>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="ms-auto"
          onPress={onRelease}
        >
          {t('whatsNew.page.release')}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </Button>
      </header>
      <p>{notes.lead}</p>
      <ReleaseNotesBody notes={notes} />
    </article>
  )
}
