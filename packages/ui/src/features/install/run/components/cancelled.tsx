import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { BackToInstall } from '@ui/features/install/run/components/back-to-install.tsx'
import { OutcomeBox } from '@ui/features/install/run/components/outcome-box.tsx'
import { useRun } from '@ui/hooks/use-run.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { ActiveRun } from '@ui/state/active-run/types.ts'

type CancelledProps = { run: ActiveRun }

/** A stopped run: the step it continues from, Resume, and Back to Install to choose again. */
export const Cancelled = ({ run }: CancelledProps) => {
  const { t } = useTranslation()
  const { resume } = useRun()
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
          <BackToInstall />
        </>
      }
    >
      {t('install.cancelled.body')}
    </OutcomeBox>
  )
}
