import { Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { StepRow } from '@ui/features/install/run/components/step-row.tsx'
import type { StepView } from '@ui/state/active-run/types.ts'

type StepListProps = {
  steps: readonly StepView[]
  /** The app being installed, named in the release step ("SideStore 0.7.0"). */
  appName: string
}

/** Every step of the run, in order, as the Engine announced them. */
export const StepList = ({ steps, appName }: StepListProps) => {
  const { t } = useTranslation()

  return (
    <Card>
      <Card.Content>
        <ol
          aria-label={t('install.run.steps')}
          className="flex flex-col gap-0.5"
        >
          {steps.map((step) => (
            <StepRow key={step.id} step={step} appName={appName} />
          ))}
        </ol>
      </Card.Content>
    </Card>
  )
}
