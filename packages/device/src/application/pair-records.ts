// Where pair records live: usbmuxd (shared with the OS) first, Loadstar's secret store as the fallback.
import type { DeviceContext } from "@device/application/context.ts";
import { shortUdid, type UsbmuxDevice } from "@device/domain/device.ts";
import { type PairRecord, parsePairRecord, serializePairRecord } from "@device/domain/pairing/pair-record.ts";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

/** Where a new pair record was saved. */
export type PairRecordStore = "usbmuxd" | "secret_store";

/** Key under which a pair record is kept when usbmuxd refuses to store it. */
export const pairRecordSecretKey = (udid: string): string => `pair-record/${udid}`;

export const notPairedError = (udid: string): LoadstarError =>
  new LoadstarError(ErrorCode.DeviceNotPaired, { data: { device: shortUdid(udid) } });

/** The pair record for `udid`: usbmuxd's (the OS trusts this host) first, then Loadstar's own copy. */
export const getPairRecord = async (ctx: DeviceContext, udid: string): Promise<PairRecord | undefined> => {
  const { logger, config, secrets } = ctx.deps;
  const fromUsbmux = await ctx.usbmux.readPairRecord(udid);
  if (fromUsbmux) {
    logger.debug("pair record from usbmuxd", { device: shortUdid(udid) });
    return parsePairRecord(fromUsbmux, config.plist);
  }
  const stored = await secrets.get(pairRecordSecretKey(udid));
  if (stored) {
    logger.debug("pair record from the secret store", { device: shortUdid(udid) });
    return parsePairRecord(stored, config.plist);
  }
  return undefined;
};

/** Like `getPairRecord`, but throws `device.not_paired` when there is none. */
export const requirePairRecord = async (ctx: DeviceContext, udid: string): Promise<PairRecord> => {
  const record = await getPairRecord(ctx, udid);
  if (!record) throw notPairedError(udid);
  return record;
};

/** Saves a new pair record to usbmuxd so the OS and other tools share it; if usbmuxd refuses, to the secret store. */
export const savePairRecord = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  record: PairRecord,
): Promise<PairRecordStore> => {
  const bytes = serializePairRecord(record);
  try {
    await ctx.usbmux.savePairRecord(device.udid, bytes, device.deviceId);
    return "usbmuxd";
  } catch (error) {
    ctx.deps.logger.warn("usbmuxd did not store the pair record; keeping it in the secret store", { cause: error });
    await ctx.deps.secrets.set(pairRecordSecretKey(device.udid), bytes);
    return "secret_store";
  }
};

/** Exports a pair record as plist bytes (for backups or other hosts). */
export const exportPairRecord = (record: PairRecord): Uint8Array => serializePairRecord(record);

/** Imports a pair record from plist bytes into Loadstar's own store. */
export const importPairRecord = async (ctx: DeviceContext, udid: string, data: Uint8Array): Promise<PairRecord> => {
  const record = parsePairRecord(data, ctx.deps.config.plist);
  await ctx.deps.secrets.set(pairRecordSecretKey(udid), serializePairRecord(record));
  return record;
};
