import { ProgressBar } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import {
  installPhaseKeys,
  provisionTaskKeys
} from '@ui/features/install/run/constants.ts'
import { useTimeLeft } from '@ui/features/install/run/hooks/use-time-left.ts'
import type { LiveProgress } from '@ui/features/install/run/types.ts'
import { useFormat } from '@ui/hooks/use-format.ts'

type StepLiveProps = {
  progress: LiveProgress
  /** The step's name, for the bar's accessible label. */
  label: string
}

/**
 * A running step's bar and numbers: what it's doing (requests to Apple, the bytes moved, or iOS's percent and phase)
 * on the start side, the speed and the time left on the end side.
 */
export const StepLive = ({ progress, label }: StepLiveProps) => {
  const { t } = useTranslation()
  const { fileSize } = useFormat()
  const timeLeft = useTimeLeft()
  const { percent, bytes, bytesPerSecond, secondsLeft, phase, task } = progress
  const taskKey = task ? provisionTaskKeys[task.name] : undefined
  const count = task
    ? t('install.run.live.count', { done: task.done, total: task.total })
    : undefined

  const doneText = () => {
    if (task)
      return taskKey
        ? t('install.run.live.task.line', { task: t(taskKey), count })
        : count
    if (bytes)
      return t('install.run.detail.bytes', {
        received: fileSize(bytes.received),
        total: fileSize(bytes.total)
      })
    return t('install.run.live.installing', {
      fraction: percent / 100,
      phase: t(installPhaseKeys[phase ?? 'installing'])
    })
  }

  const done = doneText()
  const pace = [
    bytesPerSecond
      ? t('install.run.live.speed', { speed: fileSize(bytesPerSecond) })
      : undefined,
    phase ? t('install.run.live.ios') : undefined,
    secondsLeft === undefined ? undefined : timeLeft(secondsLeft)
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="col-start-2 col-end-4 flex flex-col gap-1 pt-1 font-normal">
      <ProgressBar aria-label={label} value={percent} size="sm">
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-muted text-xs tabular-nums">
        <span>{done}</span>
        {pace ? <span>{pace}</span> : null}
      </div>
    </div>
  )
}
