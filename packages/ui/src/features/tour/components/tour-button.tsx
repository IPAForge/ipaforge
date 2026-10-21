import { Button } from '@heroui/react'
import { Compass } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useGuide } from '@ui/hooks/use-guide.ts'

/** The tour's button in the top bar: starts the tour of the pages (hidden while the setup guide is open). */
export const TourButton = () => {
  const { t } = useTranslation()
  const { guide, showTourStop } = useGuide()
  if (guide.status === 'open') return null
  const onPress = () => showTourStop(0)

  return (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      aria-label={t('topBar.tour')}
      data-tour="showAround"
      onPress={onPress}
    >
      <Compass aria-hidden="true" className="size-4" />
    </Button>
  )
}
