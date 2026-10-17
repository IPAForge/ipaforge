import { useTranslation } from 'react-i18next'

import type { StatusTone } from '@ui/components/shell/status-dot.tsx'
import {
  type DeviceState,
  deviceState,
  deviceTone
} from '@ui/features/devices/device-state.ts'
import { useDeviceStatus } from '@ui/hooks/queries/use-device-status.ts'
import type { ListedDevice } from '@ui/hooks/queries/use-devices.ts'
import type { DeviceCheck } from '@ui/services/engine/engine-types.ts'

export type DeviceView = {
  readonly name: string
  /** The name came from the device (false: "Unknown device", until a read succeeds). */
  readonly isNamed: boolean
  /** "iPhone17,1 · iOS 26.1 · USB": what is known, without the state. */
  readonly line: string
  /** "iPhone17,1 · iOS 26.1 · USB", then the state when it is not ready. */
  readonly subtitle: string
  /** "USB", "Wi-Fi" or "USB and Wi-Fi"; empty when not connected. */
  readonly link: string
  /** Undefined without a device. */
  readonly state: DeviceState | undefined
  /** The state in words, when it is not ready. */
  readonly stateText: string | undefined
  readonly tone: StatusTone
  readonly check: DeviceCheck | undefined
  /** Why the last read failed, when it did. */
  readonly error: unknown
  /** Connected over Wi-Fi only (it must be awake and unlocked to answer). */
  readonly isWifiOnly: boolean
}

/** How the device is connected, in words. */
const linkKey = (device: ListedDevice | undefined) => {
  if (!device) return undefined
  if (device.connections.length > 1) return 'devices.link.both' as const
  return device.connectionType === 'usb'
    ? ('devices.link.usb' as const)
    : ('devices.link.network' as const)
}

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
