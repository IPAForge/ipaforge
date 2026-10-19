import { useTranslation } from 'react-i18next'

import { AppRow } from '@ui/features/apps/components/app-row.tsx'
import type { AppRunState, AppView } from '@ui/features/apps/types.ts'
import { runStateOf } from '@ui/features/apps/utils/run-state-of.ts'

type AppsListProps = {
  views: readonly AppView[]
  runStates: ReadonlyMap<string, AppRunState>
  canAct: boolean
  onRefresh: (view: AppView) => void
  onUpdate: (view: AppView) => void
  onRemove: (view: AppView) => void
}

/** The apps IPAForge installed, soonest to expire first, or what to do when there are none yet. */
export const AppsList = ({ views, runStates, ...actions }: AppsListProps) => {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{t('apps.list.title')}</h2>
        <span className="text-muted text-sm">
          {t('apps.list.count', { count: views.length })}
        </span>
      </div>
      {views.length === 0 ? (
        <p className="rounded-xl border border-border border-dashed p-6 text-center text-muted text-sm">
          {t('apps.list.empty')}
        </p>
      ) : (
        <ul aria-label={t('apps.list.title')} className="flex flex-col gap-2">
          {views.map((view) => (
            <AppRow
              key={view.app.bundleId}
              view={view}
              runState={runStateOf(view, runStates)}
              {...actions}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
