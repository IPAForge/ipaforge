import { useTranslation } from 'react-i18next'

import { guideStepLabelKeys } from '@ui/features/guide/constants.ts'
import type { GuideStep } from '@ui/features/guide/types.ts'

type GuideStepLinkProps = {
  step: GuideStep
  number: number
  isCurrent: boolean
  isDone: boolean
  onGoTo: (step: GuideStep) => void
}

/** One step in the guide's list: its number (a tick when done) and name; opens the step. */
export const GuideStepLink = ({
  step,
  number,
  isCurrent,
  isDone,
  onGoTo
}: GuideStepLinkProps) => {
  const { t } = useTranslation()
  const onClick = () => onGoTo(step)

  return (
    <button
      type="button"
      aria-current={isCurrent ? 'step' : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm ${isCurrent ? 'bg-accent-soft font-medium text-accent-soft-foreground' : 'hover:bg-surface-secondary'}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${isDone ? 'bg-success-soft text-success-soft-foreground' : 'bg-surface-tertiary text-muted'}`}
      >
        {isDone ? '✓' : String(number)}
      </span>
      <span className="min-w-0 break-words">{t(guideStepLabelKeys[step])}</span>
      {isDone ? <span className="sr-only">{t('guide.stepDone')}</span> : null}
    </button>
  )
}
