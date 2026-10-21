import { Button, Chip } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { AppIcon } from '@ui/components/app-icon.tsx'
import { AppRunLine } from '@ui/features/apps/components/app-run-line.tsx'
import { ExpiryLabel } from '@ui/features/apps/components/expiry-label.tsx'
import { PairingTag } from '@ui/features/apps/components/pairing-tag.tsx'
import type { AppRunState, AppView } from '@ui/features/apps/types.ts'
import { CheckSideStoreButton } from '@ui/features/repair/components/check-sidestore-button.tsx'
import { isSideStore } from '@ui/features/repair/utils/is-sidestore.ts'

type AppRowProps = {
  view: AppView
  runState: AppRunState | undefined
  canAct: boolean
  onRefresh: (view: AppView) => void
  needsPairing: boolean
  onPairing: (bundleId: string) => void
  onUpdate: (view: AppView) => void
  onRemove: (view: AppView) => void
}

/**
 * An installed app: its name and version (with an update when its source has one), when it expires and where it
 * came from, and Update, Refresh and Remove. The buttons sit beside the text in a wide row and under it (lined up
 * with the text) in a narrow one; long names and links wrap, they never push the buttons out.
 */
export const AppRow = ({
  view,
  runState,
  canAct,
  onRefresh,
  needsPairing,
  onPairing,
  onUpdate,
  onRemove
}: AppRowProps) => {
  const { t } = useTranslation()
  const { app, update, from } = view
  const onPairingPress = () => onPairing(view.app.bundleId)
  const onRefreshPress = () => onRefresh(view)
  const onUpdatePress = () => onUpdate(view)
  const onRemovePress = () => onRemove(view)

  return (
    <li
      className={`@container rounded-xl border bg-surface px-3 py-2.5 ${view.tone === 'expired' ? 'border-danger/45' : 'border-border'}`}
    >
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 @xl:grid-cols-[2.25rem_minmax(0,1fr)_auto]">
        <AppIcon name={app.name} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-semibold">
            {app.name}
            {app.version ? (
              <span className="font-normal text-muted text-sm">
                {app.version}
              </span>
            ) : null}
            {needsPairing ? (
              <PairingTag name={app.name} onOpen={onPairingPress} />
            ) : null}
            {update && !runState ? (
              <Chip size="sm" color="accent">
                {t('apps.updateTo', { version: update.version })}
              </Chip>
            ) : null}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted text-xs">
            <ExpiryLabel view={view} />
            {from ? <span>{t('apps.from', { source: from })}</span> : null}
          </p>
          {view.refresh ? null : (
            <p className="text-muted text-xs">{t('apps.needsIpa')}</p>
          )}
          {runState ? <AppRunLine state={runState} name={app.name} /> : null}
        </div>
        {runState ? null : (
          <div className="col-start-2 flex flex-wrap gap-2 @xl:col-start-3 @xl:row-start-1 @xl:justify-end">
            {update ? (
              <Button size="sm" onPress={onUpdatePress} isDisabled={!canAct}>
                {t('apps.update')}
              </Button>
            ) : null}
            {view.refresh ? (
              <Button
                size="sm"
                variant="secondary"
                onPress={onRefreshPress}
                isDisabled={!canAct}
              >
                {t('apps.refresh')}
              </Button>
            ) : null}
            {isSideStore(app.bundleId) ? <CheckSideStoreButton /> : null}
            <Button
              size="sm"
              variant="tertiary"
              onPress={onRemovePress}
              isDisabled={!canAct}
              aria-label={t('apps.removeApp', { name: app.name })}
            >
              {t('apps.remove')}
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}
