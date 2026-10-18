import { Chip, ProgressBar } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { runTitleKeys } from '@ui/features/install/run/constants.ts'
import type { RunTarget } from '@ui/features/install/run/types.ts'
import { overallPercent } from '@ui/state/active-run/run-view.ts'
import type { RunView } from '@ui/state/active-run/types.ts'

type RunHeaderProps = { view: RunView; target: RunTarget }

/** The run's title, what it installs where, and the overall progress from the Engine. */
export const RunHeader = ({ view, target }: RunHeaderProps) => {
  const { t } = useTranslation()
  const percent = t('install.run.percent', { fraction: view.fraction })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-semibold text-2xl">
            {t(runTitleKeys[target.kind][view.status], {
              app: target.app,
              count: target.count
            })}
          </h1>
          <p className="text-muted text-sm">
            {target.channel
              ? t('install.run.subtitle', {
                  channel: target.channel,
                  device: target.deviceName,
                  appleId: target.appleId
                })
              : t('install.run.subtitleApps', {
                  device: target.deviceName,
                  appleId: target.appleId
                })}
          </p>
        </div>
        <Chip size="sm">{percent}</Chip>
      </div>
      <ProgressBar
        aria-label={t('install.run.progress')}
        value={overallPercent(view)}
        color={view.status === 'failed' ? 'danger' : 'accent'}
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
    </div>
  )
}
