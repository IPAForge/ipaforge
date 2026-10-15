import type { DeviceContext } from "@device/application/context.ts";
import { LOCKDOWN_PORT } from "@device/domain/constants.ts";
import { shortUdid, type UsbmuxDevice } from "@device/domain/device.ts";
import {
  lockdownPairRecord,
  type PairRecord,
  parsePairRecord,
  serializePairRecord,
} from "@device/domain/pairing/pair-record.ts";
import { createLockdownClient, type LockdownClient } from "@device/infrastructure/lockdown/client.ts";
import { createPairRecord } from "@device/infrastructure/pairing/certificates.ts";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

export type PairingProgress =
  | { readonly stage: "waiting_for_trust" }
  | { readonly stage: "waiting_for_unlock" }
  | { readonly stage: "paired"; readonly savedTo: "usbmuxd" | "secret_store" };

export interface PairOptions {
  readonly onProgress?: (event: PairingProgress) => void;
  readonly signal?: AbortSignal;
}

/** Key under which a pair record is kept when usbmuxd refuses to store it. */
export const pairRecordSecretKey = (udid: string): string => `pair-record/${udid}`;

export const openLockdown = async (ctx: DeviceContext, device: UsbmuxDevice): Promise<LockdownClient> => {
  const link = await ctx.usbmux.connect(device.deviceId, LOCKDOWN_PORT);
  const lockdown = createLockdownClient(link, {
    label: ctx.deps.config.label,
    limits: ctx.limits,
    logger: ctx.deps.logger,
  });
  try {
    await lockdown.queryType();
    return lockdown;
  } catch (error) {
    await lockdown.close();
    throw error;
  }
};

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

const optionalString = async (lockdown: LockdownClient, key: string): Promise<string | undefined> => {
  const value = await lockdown.getValue(key).catch(() => undefined);
  return typeof value === "string" ? value : undefined;
};

/**
 * Creates a new pairing. The device shows "Trust This Computer?"; we keep asking until the user answers,
 * the device is unlocked, or `pairingTimeoutMs` passes. The record is saved to usbmuxd so the OS and other
 * tools share it; if usbmuxd refuses, it is kept in the secret store.
 */
export const pairDevice = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  options: PairOptions = {},
): Promise<PairRecord> => {
  const { logger, clock, sleep, config, secrets } = ctx.deps;
  const lockdown = await openLockdown(ctx, device);
  try {
    const devicePublicKey = await lockdown.getValue("DevicePublicKey");
    if (!(devicePublicKey instanceof Uint8Array)) {
      throw new LoadstarError(ErrorCode.DeviceProtocolError, { message: "device returned no DevicePublicKey" });
    }
    const wifiMacAddress = await optionalString(lockdown, "WiFiAddress");
    const systemBuid = await ctx.usbmux.readBuid();
    const created = await createPairRecord({ devicePublicKey, systemBuid, now: clock.now() });

    const deadline = clock.now().getTime() + config.pairingTimeoutMs;
    let escrowBag: Uint8Array | undefined;
    for (;;) {
      options.signal?.throwIfAborted();
      try {
        escrowBag = await lockdown.pair(lockdownPairRecord(created));
        break;
      } catch (error) {
        const waiting =
          error instanceof LoadstarError &&
          (error.code === ErrorCode.PairingPending || error.code === ErrorCode.DeviceLocked);
        if (!waiting) throw error;
        if (clock.now().getTime() >= deadline) {
          throw new LoadstarError(ErrorCode.DeviceTimeout, { cause: error, data: { stage: "pairing" } });
        }
        options.onProgress?.({
          stage: (error as LoadstarError).code === ErrorCode.DeviceLocked ? "waiting_for_unlock" : "waiting_for_trust",
        });
        await sleep(config.pairingPollIntervalMs, options.signal);
      }
    }

    const record: PairRecord = {
      ...created,
      ...(escrowBag ? { escrowBag } : {}),
      ...(wifiMacAddress ? { wifiMacAddress } : {}),
      udid: device.udid,
    };
    const bytes = serializePairRecord(record);
    let savedTo: "usbmuxd" | "secret_store" = "usbmuxd";
    try {
      await ctx.usbmux.savePairRecord(device.udid, bytes, device.deviceId);
    } catch (error) {
      logger.warn("usbmuxd did not store the pair record; keeping it in the secret store", { cause: error });
      await secrets.set(pairRecordSecretKey(device.udid), bytes);
      savedTo = "secret_store";
    }
    logger.info("paired", { device: shortUdid(device.udid), savedTo });
    options.onProgress?.({ stage: "paired", savedTo });
    return record;
  } finally {
    await lockdown.close();
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
