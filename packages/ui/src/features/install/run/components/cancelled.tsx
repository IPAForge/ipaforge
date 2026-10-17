import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { OutcomeBox } from '@ui/features/install/run/components/outcome-box.tsx'
import { useRun } from '@ui/hooks/use-run.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { ActiveRun } from '@ui/state/active-run/types.ts'

type CancelledProps = { run: ActiveRun }

/** A stopped run: the step it continues from, Resume and Close. */
export const Cancelled = ({ run }: CancelledProps) => {
  const { t } = useTranslation()
  const { resume, dismiss } = useRun()
  const next = run.view.steps.find((step) => step.state === 'pending')

  return (
    <OutcomeBox
      tone="warning"
      title={
        next
          ? t('install.cancelled.title', {
              step: t(next.labelKey as TranslationKey)
            })
          : t('install.run.title.cancelled')
      }
      actions={
        <>
          <Button onPress={resume}>{t('install.cancelled.resume')}</Button>
          <Button variant="secondary" onPress={dismiss}>
            {t('install.cancelled.close')}
          </Button>
        </>
      }
    >
      {t('install.cancelled.body')}
    </OutcomeBox>
  )
}
