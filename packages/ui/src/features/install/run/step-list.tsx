import { Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { StepRow } from '@ui/features/install/run/step-row.tsx'
import type { StepView } from '@ui/state/active-run/run-view.ts'

type StepListProps = { steps: readonly StepView[] }

/** Every step of the run, in order, as the Engine announced them. */
export const StepList = ({ steps }: StepListProps) => {
  const { t } = useTranslation()

  return (
    <Card>
      <Card.Content>
        <ol
          aria-label={t('install.run.steps')}
          className="flex flex-col gap-0.5"
        >
          {steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </ol>
      </Card.Content>
    </Card>
  )
}
