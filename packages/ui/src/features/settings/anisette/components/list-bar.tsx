import { Button, Spinner } from '@heroui/react'
import { Activity, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { timeAgo } from '@ui/features/preload/home/utils/time-ago.ts'
import { useFormat } from '@ui/hooks/use-format.ts'
import type { AnisetteOverview } from '@ui/services/engine/types.ts'

type ListBarProps = {
  overview: AnisetteOverview
  isUpdating: boolean
  isTesting: boolean
  onUpdate: () => void
  onTestAll: () => void
}

/** How many servers and from where, when SideStore's list was fetched, Update list and Test all. */
export const ListBar = ({
  overview,
  isUpdating,
  isTesting,
  onUpdate,
  onTestAll
}: ListBarProps) => {
  const { t } = useTranslation()
  const { relativeTime } = useFormat()
  const count = (source: string) =>
    overview.servers.filter((server) => server.source === source).length
  const listAge = overview.listUpdatedAt
    ? t('settings.anisette.listUpdated', {
        ago: timeAgo(new Date(overview.listUpdatedAt), new Date(), relativeTime)
      })
    : t('settings.anisette.listNever')
  const updated = isUpdating ? t('settings.anisette.updating') : listAge

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-surface-secondary px-3 py-2.5 text-sm">
      <span className="min-w-0 flex-[1_1_16rem] text-muted">
        <span className="font-medium text-foreground">
          {t('settings.anisette.count', { count: overview.servers.length })}
        </span>{' '}
        {t('settings.anisette.sources', {
          custom: count('custom'),
          list: count('list'),
          backup: count('backup')
        })}{' '}
        {updated}
      </span>
      <Button
        size="sm"
        variant="ghost"
        isDisabled={isUpdating}
        onPress={onUpdate}
      >
        {isUpdating ? (
          <Spinner size="sm" />
        ) : (
          <RefreshCw aria-hidden="true" className="size-4" />
        )}
        {t(
          isUpdating
            ? 'settings.anisette.updating'
            : 'settings.anisette.updateList'
        )}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        isDisabled={isTesting}
        onPress={onTestAll}
      >
        <Activity aria-hidden="true" className="size-4" />
        {t(
          isTesting ? 'settings.anisette.testing' : 'settings.anisette.testAll'
        )}
      </Button>
    </div>
  )
}
