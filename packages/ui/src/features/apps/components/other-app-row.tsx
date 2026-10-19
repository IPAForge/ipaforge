import { Button } from '@heroui/react'
import { type Key, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppIcon } from '@ui/components/app-icon.tsx'
import { AppRunLine } from '@ui/features/apps/components/app-run-line.tsx'
import { ExpiryLabel } from '@ui/features/apps/components/expiry-label.tsx'
import { SourcePicker } from '@ui/features/apps/components/source-picker.tsx'
import type { AppRunState, AppView } from '@ui/features/apps/types.ts'
import { foundLine } from '@ui/features/apps/utils/found-line.ts'
import { CheckSideStoreButton } from '@ui/features/repair/components/check-sidestore-button.tsx'
import { isSideStore } from '@ui/features/repair/utils/is-sidestore.ts'

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
  const { app } = view
  const choices =
    view.refresh?.kind === 'source' ? view.refresh.choices : undefined
  const [picked, setPicked] = useState(0)
  const choice = choices?.[picked]
  // The source picked, when there's more than one: Refresh installs from it.
  const refresh =
    choice && view.refresh?.kind === 'source'
      ? { ...view.refresh, source: choice.source, from: choice.from }
      : view.refresh
  const onRefreshPress = () => onRefresh({ ...view, refresh })
  const onPick = (key: Key | null) => setPicked(Number(key ?? 0))
  const foundText = foundLine(t, refresh, choices?.length ?? 0)

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
          <p className="text-muted text-xs">{foundText}</p>
          {choices && !runState ? (
            <SourcePicker
              choices={choices}
              picked={picked}
              isDisabled={!canAct}
              onChange={onPick}
            />
          ) : null}
          {runState ? <AppRunLine state={runState} name={app.name} /> : null}
        </div>
        {(refresh || isSideStore(view.app.bundleId)) && !runState ? (
          <div className="col-start-2 flex flex-wrap gap-2 @xl:col-start-3 @xl:row-start-1 @xl:justify-end">
            {refresh ? (
              <Button
                size="sm"
                variant="secondary"
                onPress={onRefreshPress}
                isDisabled={!canAct}
              >
                {t('apps.refresh')}
              </Button>
            ) : null}
            {isSideStore(view.app.bundleId) ? <CheckSideStoreButton /> : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}
