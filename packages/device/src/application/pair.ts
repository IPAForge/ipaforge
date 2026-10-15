// Pairing: asks the device to trust this computer and stores the resulting pair record.
import type { DeviceContext } from "@device/application/context.ts";
import { openLockdown } from "@device/application/lockdown.ts";
import { type PairRecordStore, savePairRecord } from "@device/application/pair-records.ts";
import { shortUdid, type UsbmuxDevice } from "@device/domain/device.ts";
import { lockdownPairRecord, type PairRecord } from "@device/domain/pairing/pair-record.ts";
import { withClient } from "@device/infrastructure/closeable.ts";
import type { LockdownClient } from "@device/infrastructure/lockdown/client.ts";
import { createPairRecord } from "@device/infrastructure/pairing/certificates.ts";
import { compact, ErrorCode, LoadstarError } from "@loadstar/kernel";

export type PairingProgress =
  | { readonly stage: "waiting_for_trust" }
  | { readonly stage: "waiting_for_unlock" }
  | { readonly stage: "paired"; readonly savedTo: PairRecordStore };

type WaitingStage = "waiting_for_trust" | "waiting_for_unlock";

export interface PairOptions {
  readonly onProgress?: (event: PairingProgress) => void;
  readonly signal?: AbortSignal;
}

/** A non-empty string value from lockdownd, or `undefined` (missing, unreadable or empty). */
const optionalString = async (lockdown: LockdownClient, key: string): Promise<string | undefined> => {
  const value = await lockdown.getValue(key).catch(() => undefined);
  return typeof value === "string" && value !== "" ? value : undefined;
};

const readDevicePublicKey = async (lockdown: LockdownClient): Promise<Uint8Array> => {
  const devicePublicKey = await lockdown.getValue("DevicePublicKey");
  if (!(devicePublicKey instanceof Uint8Array)) {
    throw new LoadstarError(ErrorCode.DeviceProtocolError, { message: "device returned no DevicePublicKey" });
  }
  return devicePublicKey;
};

/** What the user still has to do when `Pair` fails with `error`; `undefined` when it is a real failure. */
const waitingStage = (error: unknown): WaitingStage | undefined => {
  if (!(error instanceof LoadstarError)) return undefined;
  if (error.code === ErrorCode.DeviceLocked) return "waiting_for_unlock";
  if (error.code === ErrorCode.PairingPending) return "waiting_for_trust";
  return undefined;
};

/**
 * Sends `Pair` until the user answers the trust dialog (and unlocks the device), or `pairingTimeoutMs` passes.
 * Returns the escrow bag the device hands out.
 */
const pairUntilTrusted = async (
  ctx: DeviceContext,
  lockdown: LockdownClient,
  record: PairRecord,
  options: PairOptions,
): Promise<Uint8Array | undefined> => {
  const { clock, sleep, config } = ctx.deps;
  const deadline = clock.now().getTime() + config.pairingTimeoutMs;
  for (;;) {
    options.signal?.throwIfAborted();
    try {
      return await lockdown.pair(lockdownPairRecord(record));
    } catch (error) {
      const stage = waitingStage(error);
      if (!stage) throw error;
      if (clock.now().getTime() >= deadline) {
        throw new LoadstarError(ErrorCode.DeviceTimeout, { cause: error, data: { stage: "pairing" } });
      }
      options.onProgress?.({ stage });
      await sleep(config.pairingPollIntervalMs, options.signal);
    }
  }
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
): Promise<PairRecord> =>
  withClient(await openLockdown(ctx, device), async (lockdown) => {
    const devicePublicKey = await readDevicePublicKey(lockdown);
    const wifiMacAddress = await optionalString(lockdown, "WiFiAddress");
    const systemBuid = await ctx.usbmux.readBuid();
    const created = await createPairRecord({ devicePublicKey, systemBuid, now: ctx.deps.clock.now() });
    const escrowBag = await pairUntilTrusted(ctx, lockdown, created, options);

    const record: PairRecord = compact({ ...created, escrowBag, wifiMacAddress, udid: device.udid });
    const savedTo = await savePairRecord(ctx, device, record);
    ctx.deps.logger.info("paired", { device: shortUdid(device.udid), savedTo });
    options.onProgress?.({ stage: "paired", savedTo });
    return record;
  });
