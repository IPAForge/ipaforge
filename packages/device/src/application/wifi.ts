// Wi-Fi without the cable: when a session opens, the device's Wi-Fi connections are turned on (they're off on a
// new device), and the device is remembered with its Wi-Fi MAC address, so it can be told apart when it is found
// on the network. Both are best-effort: neither ever fails the session.
import type { DeviceContext } from '@device/application/context.ts'
import {
  LockdownDomain,
  WIFI_ADDRESS_KEY,
  WIFI_CONNECTIONS_KEY
} from '@device/domain/constants.ts'
import { shortUdid } from '@device/domain/device.ts'
import type { KnownWifiDevice, UsbmuxDevice } from '@device/domain/types.ts'
import {
  normalizeMac,
  parseKnownDevices,
  serializeKnownDevices,
  WIFI_DEVICES_KEY
} from '@device/domain/wifi.ts'
import type { LockdownClient } from '@device/infrastructure/lockdown/types.ts'
import { toIPAForgeError } from '@ipaforge/kernel'

const turnOnWifiConnections = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  lockdown: LockdownClient
): Promise<void> => {
  const domain = LockdownDomain.WirelessLockdown
  if ((await lockdown.getValue(WIFI_CONNECTIONS_KEY, domain)) === true) return
  await lockdown.setValue(domain, WIFI_CONNECTIONS_KEY, true)
  ctx.deps.logger.info('turned on Wi-Fi connections', {
    device: shortUdid(device.udid)
  })
}

/** The devices this computer has opened before, so one found on Wi-Fi can be matched to its pair record. */
export const knownWifiDevices = async (
  ctx: DeviceContext
): Promise<KnownWifiDevice[]> =>
  parseKnownDevices(await ctx.deps.secrets.get(WIFI_DEVICES_KEY))

const rememberDevice = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  lockdown: LockdownClient
): Promise<void> => {
  const value = await lockdown.getValue(WIFI_ADDRESS_KEY)
  const mac = typeof value === 'string' ? normalizeMac(value) : undefined
  const known = await knownWifiDevices(ctx)
  const current = known.find((entry) => entry.udid === device.udid)
  if (current && current.mac === mac) return
  const others = known.filter((entry) => entry.udid !== device.udid)
  await ctx.deps.secrets.set(
    WIFI_DEVICES_KEY,
    serializeKnownDevices([...others, { udid: device.udid, mac }])
  )
}

/** Prepares an opened session's device for Wi-Fi: its connections on, its MAC address remembered. */
export const prepareWifi = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  lockdown: LockdownClient
): Promise<void> => {
  const steps = [
    ...(ctx.deps.config.enableWifiConnections ? [turnOnWifiConnections] : []),
    rememberDevice
  ]
  for (const step of steps) {
    try {
      await step(ctx, device, lockdown)
    } catch (error) {
      ctx.deps.logger.warn('Wi-Fi setup skipped', {
        device: shortUdid(device.udid),
        step: step.name,
        code: toIPAForgeError(error).code
      })
    }
  }
}
