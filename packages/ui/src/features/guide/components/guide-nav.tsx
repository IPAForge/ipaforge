import { Button } from '@heroui/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type GuideNavProps = {
  onBack?: (() => void) | undefined
  onSkip?: (() => void) | undefined
  onNext: () => void
  nextLabel: string
  isNextDisabled?: boolean
  /** More buttons beside Back (Check again). */
  extra?: ReactNode
}

/** A step's buttons: Back and anything extra at the start; Skip this step and the main button at the end. */
export const GuideNav = ({
  onBack,
  onSkip,
  onNext,
  nextLabel,
  isNextDisabled = false,
  extra
}: GuideNavProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {onBack ? (
        <Button variant="ghost" onPress={onBack}>
          {t('guide.back')}
        </Button>
      ) : null}
      {extra}
      <span className="flex-1" />
      {onSkip ? (
        <Button variant="ghost" onPress={onSkip}>
          {t('guide.skip')}
        </Button>
      ) : null}
      <Button onPress={onNext} isDisabled={isNextDisabled}>
        {nextLabel}
      </Button>
    </div>
  )
}
