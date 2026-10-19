import { Alert, Button } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@ui/components/page-header.tsx'
import { AppsFacts } from '@ui/features/apps/components/apps-facts.tsx'
import { AppsList } from '@ui/features/apps/components/apps-list.tsx'
import { AppsRunFailedNotice } from '@ui/features/apps/components/apps-run-failed-notice.tsx'
import { AutoRefreshCard } from '@ui/features/apps/components/auto-refresh-card.tsx'
import { ExpiredNotice } from '@ui/features/apps/components/expired-notice.tsx'
import { OtherAppRow } from '@ui/features/apps/components/other-app-row.tsx'
import { RemoveAppDialog } from '@ui/features/apps/components/remove-app-dialog.tsx'
import { useAppActions } from '@ui/features/apps/hooks/use-app-actions.ts'
import { useAppRunStates } from '@ui/features/apps/hooks/use-app-run-states.ts'
import { useApps } from '@ui/features/apps/hooks/use-apps.ts'
import type { AppView } from '@ui/features/apps/types.ts'
import { runStateOf } from '@ui/features/apps/utils/run-state-of.ts'
import { SignInNeededNotice } from '@ui/features/install/home/components/sign-in-needed-notice.tsx'
import { useRun } from '@ui/hooks/use-run.ts'
import { isRunActive } from '@ui/state/active-run/run-view.ts'

/**
 * Apps: what IPAForge installed on the device in use, soonest to expire first, with Refresh (sign it again from its
 * kept IPA, keeping its data), Update (its source has a newer version) and Remove; the apps other tools installed
 * with the same Apple ID; and refreshing apps automatically.
 */
export const AppsPage = () => {
  const { t } = useTranslation()
  const apps = useApps()
  const { refresh, update, isPlanning } = useAppActions()
  const runStates = useAppRunStates()
  const { run } = useRun()
  const [removing, setRemoving] = useState<AppView>()
  const isConnected = apps.device?.isConnected ?? false
  const canAct =
    isConnected &&
    apps.account !== undefined &&
    !isRunActive(run?.view) &&
    !isPlanning
  const onRefreshOne = (view: AppView) => refresh([view])
  const onUpdateOne = (view: AppView) => update([view])
  const onRefreshAll = () => refresh(apps.managed)
  const onUpdateAll = () => update(apps.updates)
  const onRefreshExpired = () => refresh(apps.expired)
  const onCloseRemove = () => setRemoving(undefined)

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader titleKey="nav.apps" descriptionKey="apps.description" />
        <div className="flex flex-wrap gap-2">
          {apps.updates.length > 0 ? (
            <Button
              variant="secondary"
              onPress={onUpdateAll}
              isDisabled={!canAct}
            >
              {t('apps.updateAll', { count: apps.updates.length })}
            </Button>
          ) : null}
          <Button
            onPress={onRefreshAll}
            isDisabled={!canAct || apps.managed.length === 0}
          >
            {t('apps.refreshAll', { count: apps.managed.length })}
          </Button>
        </div>
      </div>
      <SignInNeededNotice />
      <AppsRunFailedNotice />
      {apps.device && !isConnected ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('apps.notConnected.title')}</Alert.Title>
            <Alert.Description>{t('apps.notConnected.body')}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {apps.expired.length > 0 ? (
        <ExpiredNotice
          count={apps.expired.length}
          canAct={canAct}
          onRefresh={onRefreshExpired}
        />
      ) : null}
      <AppsFacts managed={apps.managed} settings={apps.settings} />
      <AppsList
        views={apps.managed}
        runStates={runStates}
        canAct={canAct}
        onRefresh={onRefreshOne}
        onUpdate={onUpdateOne}
        onRemove={setRemoving}
      />
      {apps.others.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{t('apps.others.title')}</h2>
            <span className="text-muted text-sm">{t('apps.others.hint')}</span>
          </div>
          <ul
            aria-label={t('apps.others.title')}
            className="flex flex-col gap-2"
          >
            {apps.others.map((view) => (
              <OtherAppRow
                key={view.app.bundleId}
                view={view}
                runState={runStateOf(view, runStates)}
                canAct={canAct}
                onRefresh={onRefreshOne}
              />
            ))}
          </ul>
        </section>
      ) : null}
      <AutoRefreshCard />
      {removing && apps.device ? (
        <RemoveAppDialog
          view={removing}
          udid={apps.device.udid}
          deviceName={t('apps.thisDevice')}
          onClose={onCloseRemove}
        />
      ) : null}
    </div>
  )
}
