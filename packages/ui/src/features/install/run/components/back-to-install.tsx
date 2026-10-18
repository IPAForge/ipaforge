import { Button } from '@heroui/react'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MirroredIcon } from '@ui/components/mirrored-icon.tsx'
import { useRun } from '@ui/hooks/use-run.ts'

/**
 * Leaves a run that has ended for the Install page, to choose again (another app, channel or Apple ID). What the
 * run already registered with Apple is reused by the next one.
 */
export const BackToInstall = () => {
  const { t } = useTranslation()
  const { dismiss } = useRun()

  return (
    <Button variant="secondary" onPress={dismiss}>
      <MirroredIcon icon={ArrowLeft} className="size-4" />
      {t('install.run.backToInstall')}
    </Button>
  )
}
