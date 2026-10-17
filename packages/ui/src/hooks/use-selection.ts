import { useContext, useMemo, useSyncExternalStore } from 'react'

import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'
import { useDeviceStatus } from '@ui/hooks/queries/use-device-status.ts'
import { type ListedDevice, useDevices } from '@ui/hooks/queries/use-devices.ts'
import type { Account } from '@ui/services/engine/types.ts'
import { SelectionContext } from '@ui/state/selection/selection-context.ts'
import type { Selection, SelectionStore } from '@ui/state/selection/types.ts'

const useSelectionStore = (): SelectionStore => {
  const store = useContext(SelectionContext)
  if (!store) throw new Error('useSelection must be used inside <App>')
  return store
}

/** What is picked, and the setter that keeps it. */
export const useSelection = (): {
  readonly selection: Selection
  readonly select: SelectionStore['select']
} => {
  const store = useSelectionStore()

  return {
    selection: useSyncExternalStore(store.subscribe, store.getState),
    select: store.select
  }
}

/** The picked one while it is still there, otherwise the first. */
export const pickActive = <T extends { readonly id: string }>(
  items: readonly T[] | undefined,
  id: string | undefined
): T | undefined => items?.find((item) => item.id === id) ?? items?.[0]

/** The device in use: connected, or picked and unplugged during this session (then `device` is undefined). */
export type DeviceInUse = {
  readonly udid: string
  readonly device: ListedDevice | undefined
  readonly isConnected: boolean
}

/** A USB device before a Wi-Fi one: installing over USB is faster and steadier. */
const firstDevice = (
  devices: readonly ListedDevice[] | undefined
): ListedDevice | undefined =>
  devices?.find((device) => device.connectionType === 'usb') ?? devices?.[0]

/**
 * The device in use: the picked one while it is connected; the picked one still, as not connected, when it was
 * unplugged during this session (it comes back by itself when plugged in again); otherwise the first connected
 * device. After a restart a picked device that isn't connected is only remembered, until it connects.
 */
export const useDeviceInUse = (): DeviceInUse | undefined => {
  const { selection } = useSelection()
  const devices = useDevices().data
  const picked = selection.device
  const pickedDevice = devices?.find((device) => device.udid === picked)
  const pickedStatus = useDeviceStatus(picked, false)
  if (pickedDevice)
    return { udid: pickedDevice.udid, device: pickedDevice, isConnected: true }
  if (picked && pickedStatus.data)
    return { udid: picked, device: undefined, isConnected: false }
  const first = firstDevice(devices)

  return first
    ? { udid: first.udid, device: first, isConnected: true }
    : undefined
}

/** The devices an Apple ID's ban counts on: the device in use. */
export const useDevicesInUse = (): readonly string[] => {
  const udid = useDeviceInUse()?.udid

  return useMemo(() => (udid ? [udid] : []), [udid])
}

/** The Apple ID in use: the picked one while it is saved, otherwise the first saved one. */
export const useActiveAccount = (): Account | undefined => {
  const { selection } = useSelection()

  return pickActive(useAccounts().data, selection.account)
}
