import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { OutcomeBox } from '@ui/features/install/run/components/outcome-box.tsx'
import type { RunTarget } from '@ui/features/install/run/types.ts'
import { useRun } from '@ui/hooks/use-run.ts'

type DoneProps = { target: RunTarget }

/** A finished run: what to do on the device before the app opens. */
export const Done = ({ target }: DoneProps) => {
  const { t } = useTranslation()
  const { dismiss } = useRun()

  return (
    <OutcomeBox
      tone="success"
      title={t('install.done.title', {
        app: target.app,
        device: target.deviceName
      })}
      actions={<Button onPress={dismiss}>{t('install.done.done')}</Button>}
    >
      <ol className="list-decimal ps-5">
        <li>{t('install.done.trust', { appleId: target.appleId })}</li>
        <li>{t('install.done.open')}</li>
      </ol>
    </OutcomeBox>
  )
}
