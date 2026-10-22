// device-probe commands about the device itself: list, info, pair, apps, profiles, reveal-devmode.
import {
  type DeviceProbe,
  printPairingProgress
} from '@desktop/probes/device/context.ts'
import type { PairMethod } from '@ipaforge/device'

export const listCommand =
  ({ manager, show }: DeviceProbe) =>
  async (): Promise<void> => {
    const devices = await manager.listDevices()
    if (devices.length === 0) console.log('no devices')
    for (const device of devices) {
      console.log(
        `${show(device.udid)}  ${device.connectionType}  paired=${await manager.isPaired(device.udid)}`
      )
    }
  }

/** wifi-list: searches the network for known devices (usbmuxd's and --udid) and lists where each was found. */
export const wifiListCommand =
  ({ discoverDirect, show }: DeviceProbe) =>
  async (): Promise<void> => {
    const started = Date.now()
    const found = await discoverDirect()
    console.log(`searched the network for ${Date.now() - started} ms`)
    if (found.length === 0) console.log('no known devices on Wi-Fi')
    for (const device of found)
      console.log(`${show(device.udid)}  wifi  ${device.address ?? '?'}`)
  }

export const infoCommand =
  ({ withDevice, show }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      const check = await handle.check()
      console.log({ ...check.info, udid: show(check.info.udid) })
      console.log({
        locked: check.locked,
        developerMode: check.developerMode,
        activated: check.activated
      })
    })

/** `--own` pairs with IPAForge's own certificates straight away; by default the OS's pairing is awaited. */
const pairMethod = ({ args }: DeviceProbe): PairMethod =>
  args.flag('own') ? 'own' : 'os'

export const pairCommand = (probe: DeviceProbe) => async (): Promise<void> => {
  const device = await probe.pickDevice()
  const method = pairMethod(probe)
  console.log(
    method === 'own'
      ? "pairing with IPAForge's own record: unlock the device and tap Trust"
      : "waiting for this computer's pairing: unlock the device and tap Trust (own pairing after the timeout)"
  )
  await probe.manager.pair(device.udid, {
    method,
    onProgress: printPairingProgress
  })
}

export const appsCommand =
  ({ withDevice }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      for (const app of await handle.listApps())
        console.log(
          `${app.bundleId}  ${app.name ?? ''}  ${app.shortVersion ?? ''}`
        )
    })

export const profilesCommand =
  ({ withDevice }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      for (const p of await handle.listProfiles()) {
        console.log(
          `${p.uuid}  ${p.name}  team=${p.teamId ?? '?'}  expires=${p.expirationDate?.toISOString() ?? '?'}`
        )
      }
    })

export const revealDevModeCommand =
  ({ withDevice }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      await handle.revealDeveloperMode()
      console.log(
        'Developer Mode is now visible in Settings › Privacy & Security.'
      )
    })
