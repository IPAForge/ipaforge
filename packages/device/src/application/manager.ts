// The device facade: finding devices (through usbmuxd and on the local network), pairing, and opening a session
// handle.
import {
  createDeviceContext,
  type DeviceContext
} from '@device/application/context.ts'
import {
  createDeviceHandle,
  type DeviceHandle
} from '@device/application/handle.ts'
import {
  discoverNetworkDevices,
  watchNetworkDevices
} from '@device/application/network-devices.ts'
import { pairDevice } from '@device/application/pair.ts'
import {
  exportPairRecord,
  getPairRecord,
  importPairRecord,
  requirePairRecord
} from '@device/application/pair-records.ts'
import { savedRecord } from '@device/application/remote-pairing.ts'
import { openSession } from '@device/application/session.ts'
import { openTunnelSession } from '@device/application/tunnel-session.ts'
import type {
  DeviceTunnel,
  OpenSessionOptions,
  PairOptions
} from '@device/application/types.ts'
import { openWifiTunnel } from '@device/application/wifi-tunnel.ts'
import { resolveDeviceDeps } from '@device/deps.ts'
import { shortUdid } from '@device/domain/device.ts'
import type { PairRecord } from '@device/domain/pairing/types.ts'
import type { DeviceEvent, UsbmuxDevice } from '@device/domain/types.ts'
import type { DeviceDepsInput } from '@device/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export type DeviceManager = {
  listDevices(): Promise<UsbmuxDevice[]>
  /** Streams attach/detach events until `signal` aborts. */
  watch(
    onEvent: (event: DeviceEvent) => void,
    signal: AbortSignal
  ): Promise<void>
  /**
   * Searches the local network for known devices until `signal` aborts, streaming them as attach/detach events
   * (each with its Wi-Fi `address`). Ends at once when the host can't search; throws `device.local_network_denied`
   * when the OS refuses local network access.
   */
  watchNetwork(
    onEvent: (event: DeviceEvent) => void,
    signal: AbortSignal
  ): Promise<void>
  /** Searches the network for a few seconds and returns the known devices found there. */
  discoverNetwork(): Promise<UsbmuxDevice[]>
  /**
   * Opens the iOS 17.4+ tunnel to `udid` on Wi-Fi, with its saved remote pairing (make one over USB first,
   * `DeviceHandle.remotePairing`). Close it when done.
   */
  openWifiTunnel(udid: string): Promise<DeviceTunnel>
  pair(udid: string, options?: PairOptions): Promise<PairRecord>
  isPaired(udid: string): Promise<boolean>
  exportPairRecord(udid: string): Promise<Uint8Array>
  importPairRecord(udid: string, data: Uint8Array): Promise<void>
  open(udid: string, options?: OpenSessionOptions): Promise<DeviceHandle>
}

const isUsbmuxdMissing = (error: unknown): boolean =>
  error instanceof IPAForgeError && error.code === ErrorCode.UsbmuxdUnavailable

/** usbmuxd's devices, or none when there is no usbmuxd (devices on Wi-Fi can still be reached directly). */
const usbmuxDevices = async (ctx: DeviceContext): Promise<UsbmuxDevice[]> => {
  try {
    return await ctx.usbmux.listDevices()
  } catch (error) {
    if (isUsbmuxdMissing(error)) return []
    throw error
  }
}

/**
 * The way to reach `udid`: by cable first, then straight over Wi-Fi (faster than usbmuxd's own Wi-Fi link, measured
 * 16–18 against 6.4 MiB/s), then usbmuxd over Wi-Fi. When none is known, a short search of the network looks for it.
 */
const notFound = (udid: string) =>
  new IPAForgeError(ErrorCode.DeviceNotFound, {
    data: { device: shortUdid(udid) }
  })

/** `udid` straight over Wi-Fi: as found by the running search, or by a short one. */
const findOnWifi = async (
  ctx: DeviceContext,
  udid: string
): Promise<UsbmuxDevice> => {
  const device =
    ctx.network.get(udid) ??
    (await discoverNetworkDevices(ctx)).find(
      (candidate) => candidate.udid === udid
    )
  if (!device) throw notFound(udid)
  return device
}

const findDevice = async (
  ctx: DeviceContext,
  udid: string,
  route: OpenSessionOptions['route'] = 'best'
): Promise<UsbmuxDevice> => {
  if (route === 'wifi') return findOnWifi(ctx, udid)
  const listed = (await usbmuxDevices(ctx)).filter(
    (candidate) => candidate.udid === udid
  )
  const usb = listed.find((candidate) => candidate.connectionType === 'usb')
  if (usb) return usb
  const direct =
    ctx.network.get(udid) ??
    (listed.length === 0
      ? (await discoverNetworkDevices(ctx)).find(
          (candidate) => candidate.udid === udid
        )
      : undefined)
  const device = direct ?? listed[0]
  if (!device) throw notFound(udid)
  return device
}

const UNREACHABLE: ReadonlySet<string> = new Set([
  ErrorCode.DeviceDisconnected,
  ErrorCode.DeviceNotFound,
  ErrorCode.DeviceTimeout
])

const isUnreachable = (error: unknown): boolean =>
  error instanceof IPAForgeError && UNREACHABLE.has(error.code)

/** A session inside the Wi-Fi tunnel, opened with the saved remote pairing; the classic record serves pairing files. */
const openOverWifiTunnel = async (ctx: DeviceContext, udid: string) => {
  const device = await findOnWifi(ctx, udid)
  const record = await requirePairRecord(ctx, udid)

  return openTunnelSession(
    ctx,
    device,
    await openWifiTunnel(ctx, device),
    record
  )
}

export const createDeviceManager = (input: DeviceDepsInput): DeviceManager => {
  const ctx = createDeviceContext(resolveDeviceDeps(input))

  return {
    listDevices: async () => {
      const network = [...ctx.network.values()]
      try {
        return [...(await ctx.usbmux.listDevices()), ...network]
      } catch (error) {
        // Without usbmuxd, devices on Wi-Fi are still reachable: only none at all is an error.
        if (isUsbmuxdMissing(error) && network.length > 0) return network
        throw error
      }
    },
    watch: (onEvent, signal) => ctx.usbmux.listen(onEvent, signal),
    watchNetwork: (onEvent, signal) =>
      watchNetworkDevices(ctx, onEvent, signal),
    discoverNetwork: () => discoverNetworkDevices(ctx),
    openWifiTunnel: async (udid) =>
      openWifiTunnel(ctx, await findOnWifi(ctx, udid)),
    pair: async (udid, options) =>
      (await pairDevice(ctx, await findDevice(ctx, udid), options)).record,
    isPaired: async (udid) => (await getPairRecord(ctx, udid)) !== undefined,
    exportPairRecord: async (udid) =>
      exportPairRecord(await requirePairRecord(ctx, udid)),
    importPairRecord: async (udid, data) => {
      await importPairRecord(ctx, udid, data)
    },
    open: async (udid, options) => {
      if (options?.route === 'wifi-tunnel')
        return createDeviceHandle(ctx, await openOverWifiTunnel(ctx, udid))
      const device = await findDevice(ctx, udid, options?.route)
      try {
        return createDeviceHandle(ctx, await openSession(ctx, device, options))
      } catch (error) {
        // Lockdown straight over Wi-Fi didn't answer: the remote pairing's tunnel is the other way in.
        if (
          device.address === undefined ||
          !isUnreachable(error) ||
          !(await savedRecord(ctx, udid))
        )
          throw error
        ctx.deps.logger.info('Wi-Fi lockdown unreachable; trying the tunnel', {
          device: shortUdid(udid)
        })
        try {
          return createDeviceHandle(ctx, await openOverWifiTunnel(ctx, udid))
        } catch {
          throw error
        }
      }
    }
  }
}
