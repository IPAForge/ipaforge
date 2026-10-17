import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { CopyDiagnostics } from '@ui/features/install/run/components/copy-diagnostics.tsx'
import { OutcomeBox } from '@ui/features/install/run/components/outcome-box.tsx'
import type { OutcomeProps } from '@ui/features/install/run/types.ts'
import { diagnosticsText } from '@ui/features/install/run/utils/diagnostics-text.ts'
import { stepLabel } from '@ui/features/install/run/utils/step-label.ts'
import { useRun } from '@ui/hooks/use-run.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'
import { errorBodyKey, errorTitleKey } from '@ui/i18n/required-keys.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { RunFailure } from '@ui/state/active-run/types.ts'

type FailedProps = OutcomeProps & { failure: RunFailure }

/** A failed run: what went wrong in the words for its code, Try again from where it stopped, and diagnostics. */
export const Failed = ({ run, failure, target }: FailedProps) => {
  const { t } = useTranslation()
  const { appVersion } = useUiServices()
  const { resume, restart } = useRun()
  const label = stepLabel(run, failure.stepId)
  const onTryAgain = () => (run.view.checkpoint ? resume() : restart({}))

  return (
    <OutcomeBox
      tone="danger"
      title={t(errorTitleKey(failure.error.code))}
      actions={
        <>
          <Button onPress={onTryAgain}>{t('install.failed.tryAgain')}</Button>
          <CopyDiagnostics
            text={diagnosticsText(appVersion, run, failure, target)}
          />
        </>
      }
    >
      <p>{t(errorBodyKey(failure.error.code))}</p>
      {label && run.view.checkpoint ? (
        <p className="mt-1 text-xs">
          {t('install.failed.continues', {
            step: t(label as TranslationKey)
          })}
        </p>
      ) : null}
    </OutcomeBox>
  )
}
