// The fake Engine's connected devices and their live feed, like the Engine's `watchDevices`: the list first, then
// each attach and detach with the list after it. Tests plug devices in and out; the `hot-plug` scenario does it on
// a timer so the dev host shows the feed, and `local-network-denied` says macOS refused the search on Wi-Fi.
import type { DeviceWatchEvent } from '@ipaforge/rpc'
import { FAKE_IPAD, fakeDevices } from '@ui/services/engine/fake/fake-data.ts'
import type {
  DeviceFeedListener,
  FakeDeviceFeed
} from '@ui/services/engine/fake/types.ts'
import type { Device } from '@ui/services/engine/types.ts'

/** How often the `hot-plug` scenario plugs the iPad in or out. */
const HOT_PLUG_INTERVAL_MS = 5000

export const createFakeDeviceFeed = (
  hotPlug: boolean,
  initial: readonly Device[] = fakeDevices,
  isLocalNetworkDenied = false
): FakeDeviceFeed => {
  let devices = [...initial]
  const listeners = new Set<DeviceFeedListener>()
  let timer: ReturnType<typeof setInterval> | undefined

  const emit = (event: DeviceWatchEvent) => {
    for (const listener of [...listeners]) listener(event)
    for (const listener of [...listeners])
      listener({ type: 'devices', devices })
  }

  const plugIn = (device: Device) => {
    devices = [...devices.filter((known) => known.udid !== device.udid), device]
    emit({ type: 'attached', device })
  }

  const unplug = (udid: string) => {
    const gone = devices.filter((known) => known.udid === udid)
    if (gone.length === 0) return
    devices = devices.filter((known) => known.udid !== udid)
    for (const device of gone)
      emit({ type: 'detached', deviceId: device.deviceId, udid })
  }

  const toggleIpad = () => {
    const ipad = fakeDevices.find((device) => device.udid === FAKE_IPAD)
    if (devices.some((device) => device.udid === FAKE_IPAD)) unplug(FAKE_IPAD)
    else if (ipad) plugIn(ipad)
  }

  const stopIfIdle = () => {
    if (listeners.size > 0 || !timer) return
    clearInterval(timer)
    timer = undefined
  }

  return {
    list: () => devices,
    watch: (listener, signal) => {
      listeners.add(listener)
      listener({ type: 'devices', devices })
      if (isLocalNetworkDenied) listener({ type: 'network', denied: true })
      if (hotPlug && !timer)
        timer = setInterval(toggleIpad, HOT_PLUG_INTERVAL_MS)
      const unsubscribe = () => {
        listeners.delete(listener)
        stopIfIdle()
      }
      signal?.addEventListener('abort', unsubscribe, { once: true })
      return unsubscribe
    },
    plugIn,
    unplug
  }
}
