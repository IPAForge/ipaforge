import { useTranslation } from 'react-i18next'

import { deviceTone } from '@ui/features/devices/constants.ts'
import type { DeviceView } from '@ui/features/devices/types.ts'
import { deviceState } from '@ui/features/devices/utils/device-state.ts'
import { linkKey } from '@ui/features/devices/utils/link-key.ts'
import { useDeviceStatus } from '@ui/hooks/queries/use-device-status.ts'
import type { ListedDevice } from '@ui/hooks/queries/use-devices.ts'

/**
 * A device's name, details and state, from the one status query per device that every component showing it
 * shares. `device` is undefined for a picked device that is not connected. Without a udid: nothing, "off".
 */
export const useDeviceView = (
  udid: string | undefined,
  device: ListedDevice | undefined
): DeviceView => {
  const { t } = useTranslation()
  const isConnected = device !== undefined
  const status = useDeviceStatus(udid, isConnected)
  if (!udid)
    return {
      name: t('topBar.noDevice'),
      isNamed: false,
      line: '',
      subtitle: '',
      link: '',
      state: undefined,
      stateText: undefined,
      tone: 'off',
      check: undefined,
      error: undefined,
      isWifiOnly: false
    }
  const state = deviceState(status, isConnected)
  const info = status.data?.info
  const key = linkKey(device)
  const link = key ? t(key) : ''
  const model = info
    ? { model: info.productType, ios: info.productVersion }
    : undefined
  const describe = () => {
    if (!model) return link
    return link
      ? t('devices.line', { ...model, link })
      : t('devices.model', model)
  }
  const line = describe()
  const stateText = state === 'ready' ? undefined : t(`devices.state.${state}`)
  const withState = () => {
    if (!stateText) return line
    if (!line) return stateText
    return t('devices.withState', { line, state: stateText })
  }

  return {
    name: info?.name ?? t('devices.unknownDevice'),
    isNamed: info !== undefined,
    line,
    subtitle: withState(),
    link,
    state,
    stateText,
    tone: deviceTone[state],
    check: status.data,
    error: status.error,
    isWifiOnly:
      device?.connections.length === 1 && device.connectionType === 'network'
  }
}
