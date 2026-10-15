// What every device-probe command works with: the device manager over the system usbmuxd, the parsed command
// line, and helpers to pick and open a device.
import { createMemorySecretStore } from "@desktop/main/adapters/memory-secret-store.ts";
import { createNodeUsbmuxTransport } from "@desktop/main/adapters/usbmux-transport.ts";
import type { DeviceProbeArgs } from "@desktop/probes/device/args.ts";
import { createProbeLogger } from "@desktop/probes/shared/logger.ts";
import {
  createDeviceManager,
  type DeviceHandle,
  type DeviceManager,
  type PairingProgress,
  shortUdid,
  type UsbmuxDevice,
} from "@loadstar/device";

export interface DeviceProbe {
  readonly manager: DeviceManager;
  readonly args: DeviceProbeArgs;
  /** A UDID as printed: shortened unless --show-udid is given. */
  readonly show: (udid: string) => string;
  /** The device named by --udid, or the first one connected. */
  readonly pickDevice: () => Promise<UsbmuxDevice>;
  /** Opens the picked device (pairing if needed), runs `use`, then closes it. */
  readonly withDevice: (use: (handle: DeviceHandle) => Promise<void>) => Promise<void>;
}

export const printPairingProgress = (event: PairingProgress): void =>
  console.log(`pairing: ${event.stage.replaceAll("_", " ")}`);

export const createDeviceProbe = (args: DeviceProbeArgs): DeviceProbe => {
  const manager = createDeviceManager({
    transport: createNodeUsbmuxTransport(),
    secrets: createMemorySecretStore(),
    logger: createProbeLogger(),
  });
  const showUdid = args.flag("show-udid");

  const pickDevice = async (): Promise<UsbmuxDevice> => {
    const devices = await manager.listDevices();
    const wanted = args.option("udid");
    const device = wanted ? devices.find((d) => d.udid === wanted) : devices[0];
    if (!device) throw new Error(wanted ? `device ${wanted} not connected` : "no device connected");
    return device;
  };

  const withDevice = async (use: (handle: DeviceHandle) => Promise<void>): Promise<void> => {
    const device = await pickDevice();
    const handle = await manager.open(device.udid, { onProgress: printPairingProgress });
    try {
      await use(handle);
    } finally {
      await handle.close();
    }
  };

  return { manager, args, show: (udid) => (showUdid ? udid : shortUdid(udid)), pickDevice, withDevice };
};
