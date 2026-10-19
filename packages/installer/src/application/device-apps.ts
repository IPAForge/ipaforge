// What the on-device checklist needs to know about the device's apps, beyond its status: whether LocalDevVPN (the
// local VPN SideStore talks to the device through on iOS 17 and later) is installed. It's an App Store app, so it's
// found by its name among the user's apps.
import type { InstallerDeps } from '@installer/types.ts'

export type DeviceApps = {
  readonly localDevVpn: boolean
}

const LOCAL_DEV_VPN = 'localdevvpn'

export const deviceApps = async (
  deps: InstallerDeps,
  udid: string
): Promise<DeviceApps> => {
  const handle = await deps.devices.open(udid, { autoPair: false })

  try {
    const apps = await handle.listApps('User')

    return {
      localDevVpn: apps.some(
        (app) => app.name?.replace(/\s/g, '').toLowerCase() === LOCAL_DEV_VPN
      )
    }
  } finally {
    await handle.close()
  }
}

/** Makes the Developer Mode switch appear in Settings › Privacy & Security (it's hidden until asked for). */
export const revealDeveloperMode = async (
  deps: InstallerDeps,
  udid: string
): Promise<void> => {
  const handle = await deps.devices.open(udid, { autoPair: false })

  try {
    await handle.revealDeveloperMode()
  } finally {
    await handle.close()
  }
}
