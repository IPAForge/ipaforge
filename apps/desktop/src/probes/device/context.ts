// What every device-probe command works with: the device manager over the system usbmuxd, the parsed command
// line, and helpers to pick and open a device.
import { createMemorySecretStore } from '@desktop/main/adapters/memory-secret-store.ts'
import { createNodeUsbmuxTransport } from '@desktop/main/adapters/usbmux-transport.ts'
import type { DeviceProbeArgs } from '@desktop/probes/device/args.ts'
import { createProbeLogger } from '@desktop/probes/shared/logger.ts'
import {
  createDeviceManager,
  type DeviceHandle,
  type DeviceManager,
  type OpenSessionOptions,
  type PairingProgress,
  serializeKnownDevices,
  shortUdid,
  type UsbmuxDevice,
  WIFI_DEVICES_KEY
} from '@ipaforge/device'

export type DeviceProbe = {
  readonly manager: DeviceManager
  readonly args: DeviceProbeArgs
  /** A UDID as printed: shortened unless --show-udid is given. */
  readonly show: (udid: string) => string
  /** The device named by --udid, or the first one connected (with --direct: found on Wi-Fi). */
  readonly pickDevice: () => Promise<UsbmuxDevice>
  /** With --direct: searches the network for usbmuxd's devices and --udid, and returns those found. */
  readonly discoverDirect: () => Promise<UsbmuxDevice[]>
  /**
   * Opens the picked device (pairing if needed), runs `use`, then closes it. `route` (or --direct, --tunnel) picks
   * how: straight over Wi-Fi, or with every service through the iOS 17.4+ tunnel.
   */
  readonly withDevice: (
    use: (handle: DeviceHandle) => Promise<void>,
    route?: OpenSessionOptions['route']
  ) => Promise<void>
}

const describePairingProgress = (event: PairingProgress): string => {
  const stage = event.stage.replaceAll('_', ' ')

  return event.stage === 'paired'
    ? `${stage} (record in ${event.savedTo.replaceAll('_', ' ')})`
    : stage
}

export const printPairingProgress = (event: PairingProgress): void =>
  console.log(`pairing: ${describePairingProgress(event)}`)

export const createDeviceProbe = (args: DeviceProbeArgs): DeviceProbe => {
  const secrets = createMemorySecretStore()
  const manager = createDeviceManager({
    transport: createNodeUsbmuxTransport(),
    secrets,
    logger: createProbeLogger()
  })
  const showUdid = args.flag('show-udid')
  const isDirect = args.flag('direct')
  const flagRoute = (): OpenSessionOptions['route'] => {
    if (isDirect) return 'wifi'
    return args.flag('tunnel') ? 'tunnel' : undefined
  }

  /**
   * --direct: the device straight over Wi-Fi only. This run's secrets live in memory, so the devices to look for
   * are told first: usbmuxd's (on a cable or its own Wi-Fi link) and --udid (its pair record comes from usbmuxd).
   */
  const discoverDirect = async (): Promise<UsbmuxDevice[]> => {
    const listed = await manager.listDevices().catch(() => [])
    const udids = new Set([
      ...listed.map((device) => device.udid),
      ...(args.option('udid') ? [args.option('udid') as string] : [])
    ])
    await secrets.set(
      WIFI_DEVICES_KEY,
      serializeKnownDevices([...udids].map((udid) => ({ udid })))
    )
    return manager.discoverNetwork()
  }

  const pickDevice = async (): Promise<UsbmuxDevice> => {
    const devices = isDirect
      ? await discoverDirect()
      : await manager.listDevices()
    const wanted = args.option('udid')
    const device = wanted ? devices.find((d) => d.udid === wanted) : devices[0]
    if (!device)
      throw new Error(
        wanted ? `device ${wanted} not connected` : 'no device connected'
      )
    return device
  }

  const withDevice = async (
    use: (handle: DeviceHandle) => Promise<void>,
    route = flagRoute()
  ): Promise<void> => {
    const device = await pickDevice()
    const handle = await manager.open(device.udid, {
      onProgress: printPairingProgress,
      ...(route ? { route } : {})
    })
    if (route === 'wifi') console.log(`over Wi-Fi at ${device.address ?? '?'}`)
    if (route === 'tunnel') console.log('services through the device tunnel')
    try {
      await use(handle)
    } finally {
      await handle.close()
    }
  }

  return {
    manager,
    args,
    show: (udid) => (showUdid ? udid : shortUdid(udid)),
    pickDevice,
    discoverDirect,
    withDevice
  }
}
