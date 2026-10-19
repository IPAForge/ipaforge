import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { OutcomeBox } from '@ui/features/install/run/components/outcome-box.tsx'
import { doneKeys } from '@ui/features/install/run/constants.ts'
import type { RunTarget } from '@ui/features/install/run/types.ts'
import { usePreloadList } from '@ui/hooks/use-preload-list.ts'
import { useRun } from '@ui/hooks/use-run.ts'

type DoneProps = { target: RunTarget }

/** A finished run: what to do on the device before the app (or apps) open. */
export const Done = ({ target }: DoneProps) => {
  const { t } = useTranslation()
  const { dismiss } = useRun()
  const preload = usePreloadList()
  // The apps are installed: the Preload page starts again with an empty list.
  const onDone = () => {
    if (target.kind === 'apps') preload.clear()
    dismiss()
  }

  return (
    <OutcomeBox
      tone="success"
      title={t(doneKeys[target.kind].title, {
        app: target.app,
        count: target.count,
        device: target.deviceName
      })}
      actions={<Button onPress={onDone}>{t('install.done.done')}</Button>}
    >
      <ol className="list-decimal ps-5">
        <li>{t('install.done.trust', { appleId: target.appleId })}</li>
        <li>{t(doneKeys[target.kind].open)}</li>
      </ol>
    </OutcomeBox>
  )
}
