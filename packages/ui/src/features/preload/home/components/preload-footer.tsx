import { Button } from '@heroui/react'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Readiness } from '@ui/features/install/home/utils/readiness.ts'

type PreloadFooterProps = {
  readiness: Readiness
  /** Apps ready to install. */
  count: number
  /** Of them, the apps to save as signed .ipa files instead. */
  saving: number
  hasItems: boolean
  onInstall: () => void
  onClear: () => void
}

/** Install the ready apps, empty the list, and the one thing to do first when Install can't be pressed. */
export const PreloadFooter = ({
  readiness,
  count,
  saving,
  hasItems,
  onInstall,
  onClear
}: PreloadFooterProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg" isDisabled={!readiness.isReady} onPress={onInstall}>
        <Download aria-hidden="true" className="size-4" />
        {saving === count && count > 0
          ? t('preload.signAndSave', { count })
          : t('preload.install', { count: count - saving })}
      </Button>
      {saving > 0 && saving < count ? (
        <span className="text-muted text-sm">
          {t('preload.installAndSave', {
            install: count - saving,
            save: saving
          })}
        </span>
      ) : null}
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
