// The device facade: finding devices, pairing, and opening a session handle.
import { createDeviceContext, type DeviceContext } from "@device/application/context.ts";
import { createDeviceHandle, type DeviceHandle } from "@device/application/handle.ts";
import { type PairOptions, pairDevice } from "@device/application/pair.ts";
import {
  exportPairRecord,
  getPairRecord,
  importPairRecord,
  requirePairRecord,
} from "@device/application/pair-records.ts";
import { type OpenSessionOptions, openSession } from "@device/application/session.ts";
import { type DeviceDepsInput, resolveDeviceDeps } from "@device/deps.ts";
import { type DeviceEvent, shortUdid, type UsbmuxDevice } from "@device/domain/device.ts";
import type { PairRecord } from "@device/domain/pairing/pair-record.ts";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

export interface DeviceManager {
  listDevices(): Promise<UsbmuxDevice[]>;
  /** Streams attach/detach events until `signal` aborts. */
  watch(onEvent: (event: DeviceEvent) => void, signal: AbortSignal): Promise<void>;
  pair(udid: string, options?: PairOptions): Promise<PairRecord>;
  isPaired(udid: string): Promise<boolean>;
  exportPairRecord(udid: string): Promise<Uint8Array>;
  importPairRecord(udid: string, data: Uint8Array): Promise<void>;
  open(udid: string, options?: OpenSessionOptions): Promise<DeviceHandle>;
}

const findDevice = async (ctx: DeviceContext, udid: string): Promise<UsbmuxDevice> => {
  const device = (await ctx.usbmux.listDevices()).find((candidate) => candidate.udid === udid);
  if (!device) throw new LoadstarError(ErrorCode.DeviceNotFound, { data: { device: shortUdid(udid) } });
  return device;
};

export const createDeviceManager = (input: DeviceDepsInput): DeviceManager => {
  const ctx = createDeviceContext(resolveDeviceDeps(input));
  return {
    listDevices: () => ctx.usbmux.listDevices(),
    watch: (onEvent, signal) => ctx.usbmux.listen(onEvent, signal),
    pair: async (udid, options) => pairDevice(ctx, await findDevice(ctx, udid), options),
    isPaired: async (udid) => (await getPairRecord(ctx, udid)) !== undefined,
    exportPairRecord: async (udid) => exportPairRecord(await requirePairRecord(ctx, udid)),
    importPairRecord: async (udid, data) => {
      await importPairRecord(ctx, udid, data);
    },
    open: async (udid, options) =>
      createDeviceHandle(ctx, await openSession(ctx, await findDevice(ctx, udid), options)),
  };
};
