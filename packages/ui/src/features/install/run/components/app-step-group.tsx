import { Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { AppIcon } from '@ui/components/app-icon.tsx'
import { StepRow } from '@ui/features/install/run/components/step-row.tsx'
import {
  groupStateText,
  refreshNoteKeys
} from '@ui/features/install/run/constants.ts'
import type { AppStepGroup as Group } from '@ui/features/install/run/types.ts'
import { groupState } from '@ui/features/install/run/utils/group-steps.ts'

type AppStepGroupProps = { group: Group }

/** One app's steps (or the shared ones), under its name and how it is going. */
export const AppStepGroup = ({ group }: AppStepGroupProps) => {
  const { t } = useTranslation()
  const { app, steps } = group
  const title = app?.name ?? t('preload.run.shared')
  const state = groupStateText[groupState(steps)]

  return (
    <Card>
      <Card.Content className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          {app ? <AppIcon name={app.name} size="sm" /> : null}
          <h2 className="min-w-0 flex-1 font-semibold">{title}</h2>
          <span className={`text-xs ${state.className}`}>{t(state.key)}</span>
        </div>
        {app?.refresh ? (
          <p className="text-muted text-xs">
            {t(refreshNoteKeys[app.refresh])}
          </p>
        ) : null}
        <ol aria-label={title} className="flex flex-col gap-0.5">
          {steps.map((step) => (
            <StepRow key={step.id} step={step} appName={app?.name ?? ''} />
          ))}
        </ol>
      </Card.Content>
    </Card>
  )
}
