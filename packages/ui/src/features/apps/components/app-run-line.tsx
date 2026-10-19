import { ProgressBar } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { appRunLineKeys } from '@ui/features/apps/constants.ts'
import type { AppRunState } from '@ui/features/apps/types.ts'

type AppRunLineProps = { state: AppRunState; name: string }

/** In a row while its app is refreshed or updated: the step and a bar, or that Apple is asked first, or that it waits for its turn. */
export const AppRunLine = ({ state, name }: AppRunLineProps) => {
  const { t } = useTranslation()

  if (state.kind !== 'running')
    return <p className="text-muted text-xs">{t(appRunLineKeys[state.kind])}</p>

  return (
    <div className="flex flex-col gap-1">
      <ProgressBar aria-label={name} value={state.fraction * 100} size="sm">
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <p className="text-muted text-xs">{t(state.labelKey)}</p>
    </div>
  )
}
