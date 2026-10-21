import { Button, Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { StepHeader } from '@ui/features/guide/components/step-header.tsx'
import { useGuideStep } from '@ui/features/guide/hooks/use-guide-step.ts'
import { LanguageSettings } from '@ui/features/settings/components/language-settings.tsx'

/** What the guide does and what to have at hand, the language, and Start or I know my way around. */
export const WelcomeStep = () => {
  const { t } = useTranslation()
  const { onContinue, onFinish } = useGuideStep()

  return (
    <>
      <StepHeader titleKey="guide.welcome.title" leadKey="guide.welcome.lead" />
      <LanguageSettings />
      <Card>
        <Card.Content className="flex flex-col gap-2">
          <h2 className="font-semibold">{t('guide.welcome.needTitle')}</h2>
          <ul className="flex list-disc flex-col gap-1 ps-5 text-muted text-sm">
            <li>{t('guide.welcome.needDevice')}</li>
            <li>{t('guide.welcome.needAppleId')}</li>
            <li>{t('guide.welcome.needPasscode')}</li>
          </ul>
        </Card.Content>
      </Card>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button variant="ghost" onPress={onFinish}>
          {t('guide.welcome.skipGuide')}
        </Button>
        <span className="flex-1" />
        <Button onPress={onContinue}>{t('guide.welcome.start')}</Button>
      </div>
    </>
  )
}
