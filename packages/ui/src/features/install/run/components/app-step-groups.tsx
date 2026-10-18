import { useTranslation } from 'react-i18next'

import { AppStepGroup } from '@ui/features/install/run/components/app-step-group.tsx'
import { groupSteps } from '@ui/features/install/run/utils/group-steps.ts'
import type { RunApp, StepView } from '@ui/state/active-run/types.ts'

type AppStepGroupsProps = {
  steps: readonly StepView[]
  apps: readonly RunApp[]
}

/** An apps run's steps grouped by app, the shared ones (the device, the Apple ID) first. */
export const AppStepGroups = ({ steps, apps }: AppStepGroupsProps) => {
  const { t } = useTranslation()

  return (
    <section
      aria-label={t('install.run.steps')}
      className="flex flex-col gap-3"
    >
      {groupSteps(steps, apps).map((group) => (
        <AppStepGroup key={group.key} group={group} />
      ))}
    </section>
  )
}
