import { useTranslation } from 'react-i18next'

import { AroundCard } from '@ui/features/guide/components/around-card.tsx'
import { GuideNav } from '@ui/features/guide/components/guide-nav.tsx'
import { StepHeader } from '@ui/features/guide/components/step-header.tsx'
import { aroundCards } from '@ui/features/guide/constants.ts'
import { useGuideStep } from '@ui/features/guide/hooks/use-guide-step.ts'

/** You're set up: where each part of IPAForge is, then the tour of the pages (it starts as the guide closes). */
export const AroundStep = () => {
  const { t } = useTranslation()
  const nav = useGuideStep()

  return (
    <>
      <StepHeader titleKey="guide.around.title" leadKey="guide.around.lead" />
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
        {aroundCards.map((id) => (
          <AroundCard key={id} id={id} />
        ))}
      </ul>
      <p className="text-muted text-sm">{t('guide.around.again')}</p>
      <GuideNav
        onBack={nav.onBack}
        onNext={nav.onContinue}
        nextLabel={t('guide.around.showMe')}
      />
    </>
  )
}
