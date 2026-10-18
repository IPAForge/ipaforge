import { Button } from '@heroui/react'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Readiness } from '@ui/features/install/home/utils/readiness.ts'

type PreloadFooterProps = {
  readiness: Readiness
  /** Apps ready to install. */
  count: number
  hasItems: boolean
  onInstall: () => void
  onClear: () => void
}

/** Install the ready apps, empty the list, and the one thing to do first when Install can't be pressed. */
export const PreloadFooter = ({
  readiness,
  count,
  hasItems,
  onInstall,
  onClear
}: PreloadFooterProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg" isDisabled={!readiness.isReady} onPress={onInstall}>
        <Download aria-hidden="true" className="size-4" />
        {t('preload.install', { count })}
      </Button>
      {hasItems ? (
        <Button variant="tertiary" onPress={onClear}>
          {t('preload.clear')}
        </Button>
      ) : null}
      {readiness.isReady ? null : (
        <span className="text-muted text-sm">{t(readiness.reasonKey)}</span>
      )}
    </div>
  )
}
