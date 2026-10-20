import { ProgressBar } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { PERCENT } from '@ui/features/updates/constants.ts'
import type { UpdateIn } from '@ui/features/updates/types.ts'
import { useFormat } from '@ui/hooks/use-format.ts'

type UpdateDownloadingProps = { state: UpdateIn<'downloading'> }

/** The new version downloading: the bar, the megabytes so far and in all, and the speed. */
export const UpdateDownloading = ({ state }: UpdateDownloadingProps) => {
  const { t } = useTranslation()
  const { fileSize } = useFormat()
  const { version, transferred, total, bytesPerSecond } = state
  const percent = total > 0 ? Math.round((transferred / total) * PERCENT) : 0
  const done =
    total > 0
      ? t('install.run.detail.bytes', {
          received: fileSize(transferred),
          total: fileSize(total)
        })
      : t('updates.downloading.starting')
  const pace = [
    bytesPerSecond > 0
      ? t('install.run.live.speed', { speed: fileSize(bytesPerSecond) })
      : undefined,
    t('updates.downloading.percent', { fraction: percent / PERCENT })
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <h1 className="font-semibold text-lg">
        {t('updates.downloading.title')}
      </h1>
      <p className="text-muted text-sm">
        {t('updates.downloading.body', { version })}
      </p>
      <div className="flex w-full flex-col gap-1.5">
        <ProgressBar
          aria-label={t('updates.downloading.title')}
          value={percent}
          size="sm"
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
        <div className="flex flex-wrap justify-between gap-x-3 text-muted text-xs tabular-nums">
          <span>{done}</span>
          <span>{pace}</span>
        </div>
      </div>
    </>
  )
}
