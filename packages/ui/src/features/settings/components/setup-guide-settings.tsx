import { Button, Card } from '@heroui/react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingRow } from '@ui/features/settings/components/setting-row.tsx'
import { useGuide } from '@ui/hooks/use-guide.ts'

/** Setup guide: the tour of the pages, and the guide again from the start. */
export const SetupGuideSettings = () => {
  const { t } = useTranslation()
  const { open, showTourStop } = useGuide()
  const tourId = useId()
  const guideId = useId()
  const onRun = () => open('welcome')
  const onTour = () => showTourStop(0)

  return (
    <Card>
      <Card.Content className="flex flex-col gap-2">
        <h2 className="font-semibold text-lg">{t('settings.guide.title')}</h2>
        <div className="flex flex-col">
          <SettingRow
            titleId={tourId}
            title={t('settings.guide.tourTitle')}
            hint={t('settings.guide.tourHint')}
          >
            <Button
              variant="secondary"
              aria-describedby={tourId}
              data-tour-action="start"
              onPress={onTour}
            >
              {t('settings.guide.tour')}
            </Button>
          </SettingRow>
          <SettingRow
            titleId={guideId}
            title={t('settings.guide.title')}
            hint={t('settings.guide.text')}
          >
            <Button
              variant="secondary"
              aria-describedby={guideId}
              onPress={onRun}
            >
              {t('settings.guide.run')}
            </Button>
          </SettingRow>
        </div>
      </Card.Content>
    </Card>
  )
}
