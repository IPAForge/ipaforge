// A session that runs entirely inside the device's tunnel, for a device reached only through it (over Wi-Fi with
// its remote pairing): lockdown is the tunnel's own (`com.apple.mobile.lockdown.remote.trusted`, trusted once
// checked in, so no StartSession and no TLS of ours), and every service is its counterpart in the tunnel.
import type { DeviceContext } from '@device/application/context.ts'
import {
  enableWifiDebuggingWith,
  openSession
} from '@device/application/session.ts'
import type { DeviceSession, DeviceTunnel } from '@device/application/types.ts'
import { LOCKDOWN_REMOTE_SERVICE } from '@device/domain/constants.ts'
import { shortUdid } from '@device/domain/device.ts'
import type { PairRecord } from '@device/domain/pairing/types.ts'
import type { UsbmuxDevice } from '@device/domain/types.ts'
import { closeOnError } from '@device/infrastructure/closeable.ts'
import { createLockdownClient } from '@device/infrastructure/lockdown/client.ts'
import { toDeviceInfo } from '@device/infrastructure/lockdown/device-info.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const unavailable = (device: UsbmuxDevice, service: string) =>
  new IPAForgeError(ErrorCode.ServiceUnavailable, {
    message: `${service} is not offered through the tunnel`,
    data: { device: shortUdid(device.udid), service }
  })

/**
 * Turns on Wi-Fi debugging for a device on Wi-Fi by lockdown straight at its address: the tunnel's lockdown doesn't
 * return wireless lockdown values, and iOS 26 resets it on the write, while lockdown on Wi-Fi does both (only the
 * services it starts are closed there). Checked on an iPhone on iOS 26.6.1.
 */
const enableWifiDebuggingOnWifi = async (
  ctx: DeviceContext,
  device: UsbmuxDevice
): Promise<void> => {
  const direct = await openSession(ctx, device, {
    route: 'wifi',
    autoPair: false
  })
  try {
    await direct.enableWifiDebugging()
  } finally {
    await direct.close()
  }
}

/** A session over an open tunnel; closing it closes the tunnel too. */
export const openTunnelSession = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  tunnel: DeviceTunnel,
  pairRecord: PairRecord | undefined
): Promise<DeviceSession> =>
  closeOnError(tunnel, async () => {
    const link = await tunnel.openService(LOCKDOWN_REMOTE_SERVICE)
    if (!link) throw unavailable(device, LOCKDOWN_REMOTE_SERVICE)
    const lockdown = createLockdownClient(link, {
      label: ctx.deps.config.label,
      limits: ctx.limits,
      logger: ctx.deps.logger
    })
    let closed = false
    ctx.deps.logger.info('session opened through the tunnel', {
      device: shortUdid(device.udid)
    })

    return {
      device,
      pairRecord,
      info: async () => toDeviceInfo(await lockdown.getValue()),
      getValue: (key, domain) => lockdown.getValue(key, domain),
      setValue: (domain, key, value) => lockdown.setValue(domain, key, value),
      startService: async (service) => {
        const shim = await tunnel.openShim(service)
        if (!shim) throw unavailable(device, service)
        return shim
      },
      tunnel: async () => tunnel,
      enableWifiDebugging: () =>
        device.address === undefined
          ? enableWifiDebuggingWith(lockdown)
          : enableWifiDebuggingOnWifi(ctx, device),
      close: async () => {
        if (closed) return
        closed = true
        await lockdown.close().catch(() => undefined)
        await tunnel.close()
        ctx.deps.logger.info('session closed', {
          device: shortUdid(device.udid)
        })
      }
    }
  })
