import { useTranslation } from 'react-i18next'

/** How to turn Developer Mode on, step by step. */
export const DeveloperModeSteps = () => {
  const { t } = useTranslation()

  return (
    <ol className="list-decimal ps-5">
      <li>{t('devices.notice.developerModeOff.step1')}</li>
      <li>{t('devices.notice.developerModeOff.step2')}</li>
      <li>{t('devices.notice.developerModeOff.step3')}</li>
    </ol>
  )
}
