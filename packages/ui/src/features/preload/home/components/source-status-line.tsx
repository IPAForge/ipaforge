import { useTranslation } from 'react-i18next'

import { timeAgo } from '@ui/features/preload/home/utils/time-ago.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { SourceInfo } from '@ui/services/engine/types.ts'

type SourceStatusLineProps = { source: SourceInfo }

/** What was last read from a source: how many apps, when, what was left out, or that the last refresh failed. */
export const SourceStatusLine = ({ source }: SourceStatusLineProps) => {
  const { t } = useTranslation()
  const { relativeTime } = useFormat()
  const when = source.fetchedAt
    ? timeAgo(source.fetchedAt, new Date(), relativeTime)
    : undefined

  if (source.error)
    return (
      <>
        <span className="text-danger">{t('preload.sources.failed')}</span>
        {when ? t('preload.sources.failedCopy', { when }) : null}
      </>
    )
  if (source.kind === 'altstore' && !when)
    return <>{t('preload.sources.notRead')}</>

  return (
    <>
      {t('preload.sources.apps', { count: source.appCount })}
      {when ? ` · ${t('preload.sources.updated', { when })}` : null}
      {source.skipped
        ? ` · ${t('preload.sources.skipped', { count: source.skipped })}`
        : null}
    </>
  )
}
