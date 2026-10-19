import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { AppIcon } from '@ui/components/app-icon.tsx'
import { AppRunLine } from '@ui/features/apps/components/app-run-line.tsx'
import { ExpiryLabel } from '@ui/features/apps/components/expiry-label.tsx'
import type { AppRunState, AppView } from '@ui/features/apps/types.ts'

type OtherAppRowProps = {
  view: AppView
  runState: AppRunState | undefined
  canAct: boolean
  onRefresh: (view: AppView) => void
}

/**
 * An app IPAForge has no copy of (installed before it kept copies, or by another tool): when it expires, and either
 * Refresh (installed again from where IPAForge found it, keeping its data) or how to make it refreshable here.
 */
export const OtherAppRow = ({
  view,
  runState,
  canAct,
  onRefresh
}: OtherAppRowProps) => {
  const { t } = useTranslation()
  const { app, refresh } = view
  const onRefreshPress = () => onRefresh(view)

  return (
    <li className="@container rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 @xl:grid-cols-[2.25rem_minmax(0,1fr)_auto]">
        <AppIcon name={app.name} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
            {app.name}
            {app.version ? (
              <span className="font-normal text-muted text-sm">
                {app.version}
              </span>
            ) : null}
          </p>
          <ExpiryLabel view={view} />
          <p className="text-muted text-xs">
            {refresh?.kind === 'source'
              ? t('apps.others.found', { source: refresh.from })
              : t('apps.others.how')}
          </p>
          {runState ? <AppRunLine state={runState} name={app.name} /> : null}
        </div>
        {refresh && !runState ? (
          <div className="col-start-2 flex flex-wrap gap-2 @xl:col-start-3 @xl:row-start-1 @xl:justify-end">
            <Button
              size="sm"
              variant="secondary"
              onPress={onRefreshPress}
              isDisabled={!canAct}
            >
              {t('apps.refresh')}
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  )
}
