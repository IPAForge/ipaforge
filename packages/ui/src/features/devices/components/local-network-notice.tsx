import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { NoticeBox } from '@ui/features/devices/components/notice-box.tsx'
import { LOCAL_NETWORK_SETTINGS_URL } from '@ui/features/devices/constants.ts'
import { useLocalNetworkDenied } from '@ui/hooks/queries/use-local-network-denied.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

/** macOS refused IPAForge local network access: devices on Wi-Fi can't be found until it is allowed. */
export const LocalNetworkNotice = () => {
  const { t } = useTranslation()
  const { links } = useUiServices()
  const isDenied = useLocalNetworkDenied()
  if (!isDenied) return null
  const onOpen = () => links.open(LOCAL_NETWORK_SETTINGS_URL)

  return (
    <NoticeBox
      status="warning"
      title={t('errors.device.local_network_denied.title')}
      body={
        <>
          <p>{t('errors.device.local_network_denied.body')}</p>
          <p>{t('recovery.fix.allowLocalNetwork.how')}</p>
        </>
      }
      action={
        <Button size="sm" variant="secondary" onPress={onOpen}>
          {t('devices.localNetwork.open')}
        </Button>
      }
    />
  )
}
