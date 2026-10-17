import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { useRun } from '@ui/hooks/use-run.ts'
import type { ActiveRun } from '@ui/state/active-run/types.ts'

type RunningActionsProps = { run: ActiveRun }

/** While the run goes on: Cancel, and what it is doing (working, or waiting for an answer). */
export const RunningActions = ({ run }: RunningActionsProps) => {
  const { t } = useTranslation()
  const { cancel } = useRun()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" onPress={cancel}>
        {t('install.run.cancel')}
      </Button>
      <span className="text-muted text-sm">
        {t(
          run.view.status === 'waiting'
            ? 'install.run.waitingHint'
            : 'install.run.runningHint'
        )}
      </span>
    </div>
  )
}
