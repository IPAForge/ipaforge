import { useTranslation } from 'react-i18next'

import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'

/** No device connected at all. */
export const NoDeviceNotice = () => {
  const { t } = useTranslation()

  return (
    <NoticeBox
      status="warning"
      title={t('devices.notice.none.title')}
      body={t('devices.notice.none.body')}
    />
  )
}
