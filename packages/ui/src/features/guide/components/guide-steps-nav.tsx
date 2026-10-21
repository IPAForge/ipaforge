import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { GuideStepLink } from '@ui/features/guide/components/guide-step-link.tsx'
import { guideSteps } from '@ui/features/guide/constants.ts'
import { useGuideStep } from '@ui/features/guide/hooks/use-guide-step.ts'

/** The guide's steps (done ones ticked, any can be opened) and Finish later. */
export const GuideStepsNav = () => {
  const { t } = useTranslation()
  const { step, done, onGoTo, onLater } = useGuideStep()

  return (
    <nav
      aria-label={t('guide.stepsLabel')}
      className="flex w-64 shrink-0 flex-col gap-1 border-border border-e bg-surface p-3"
    >
      <p className="px-2 pb-2 font-semibold text-muted text-xs uppercase tracking-wide">
        {t('guide.title')}
      </p>
      <ol className="flex flex-col gap-1">
        {guideSteps.map((id, index) => (
          <li key={id}>
            <GuideStepLink
              step={id}
              number={index + 1}
              isCurrent={id === step}
              isDone={done.includes(id)}
              onGoTo={onGoTo}
            />
          </li>
        ))}
      </ol>
      <span className="flex-1" />
      <Button variant="ghost" onPress={onLater}>
        {t('guide.later')}
      </Button>
    </nav>
  )
}
