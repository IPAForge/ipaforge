// device-probe commands about the device itself: list, info, pair, apps, profiles, reveal-devmode.
import { type DeviceProbe, printPairingProgress } from "@desktop/probes/device/context.ts";

export const listCommand =
  ({ manager, show }: DeviceProbe) =>
  async (): Promise<void> => {
    const devices = await manager.listDevices();
    if (devices.length === 0) console.log("no devices");
    for (const device of devices) {
      console.log(`${show(device.udid)}  ${device.connectionType}  paired=${await manager.isPaired(device.udid)}`);
    }
  };

export const infoCommand =
  ({ withDevice, show }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      const check = await handle.check();
      console.log({ ...check.info, udid: show(check.info.udid) });
      console.log({ locked: check.locked, developerMode: check.developerMode, activated: check.activated });
    });

export const pairCommand =
  ({ manager, pickDevice }: DeviceProbe) =>
  async (): Promise<void> => {
    const device = await pickDevice();
    await manager.pair(device.udid, { onProgress: printPairingProgress });
    console.log("paired");
  };

export const appsCommand =
  ({ withDevice }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      for (const app of await handle.listApps())
        console.log(`${app.bundleId}  ${app.name ?? ""}  ${app.shortVersion ?? ""}`);
    });

export const profilesCommand =
  ({ withDevice }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      for (const p of await handle.listProfiles()) {
        console.log(`${p.uuid}  ${p.name}  team=${p.teamId ?? "?"}  expires=${p.expirationDate?.toISOString() ?? "?"}`);
      }
    });

export const revealDevModeCommand =
  ({ withDevice }: DeviceProbe) =>
  (): Promise<void> =>
    withDevice(async (handle) => {
      await handle.revealDeveloperMode();
      console.log("Developer Mode is now visible in Settings › Privacy & Security.");
    });
