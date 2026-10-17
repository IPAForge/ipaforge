import { Alert, Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { useDeviceView } from '@ui/features/devices/hooks/use-device-view.ts'
import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'
import {
  useActiveAccount,
  useDeviceInUse,
  useSelection
} from '@ui/hooks/use-selection.ts'

/**
 * Apple blocked the Apple ID in use on the device in use: apps it signs won't open there. Offers the first saved
 * Apple ID that isn't blocked on that device.
 */
export const BlockedNotice = () => {
  const { t } = useTranslation()
  const account = useActiveAccount()
  const inUse = useDeviceInUse()
  const view = useDeviceView(inUse?.udid, inUse?.device)
  const accounts = useAccounts().data ?? []
  const { select } = useSelection()
  const udid = inUse?.udid
  if (!account || !udid || !account.health.bannedOnDevices.includes(udid))
    return null
  const other = accounts.find(
    (candidate) => !candidate.health.bannedOnDevices.includes(udid)
  )
  const onUseOther = () => {
    if (other) select('account', other.id)
  }

  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {t('install.blocked.title', {
            appleId: account.appleId,
            device: view.name
          })}
        </Alert.Title>
        <Alert.Description>{t('install.blocked.body')}</Alert.Description>
      </Alert.Content>
      {other ? (
        <Button size="sm" onPress={onUseOther}>
          {t('install.blocked.use', { appleId: other.appleId })}
        </Button>
      ) : null}
    </Alert>
  )
}
