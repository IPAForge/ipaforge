// Pairing on our own (the fallback): sends lockdown `Pair` with generated certificates and keeps the record in
// Loadstar's secret store only. The OS's record in usbmuxd is never written.
import type { DeviceContext } from "@device/application/context.ts";
import { openLockdown } from "@device/application/lockdown.ts";
import { type PairOptions, reportPaired } from "@device/application/pair-options.ts";
import { saveOwnPairRecord } from "@device/application/pair-records.ts";
import { LOCKDOWN_WIFI_ADDRESS_KEY } from "@device/domain/constants.ts";
import type { UsbmuxDevice } from "@device/domain/device.ts";
import { lockdownPairRecord, type PairRecord } from "@device/domain/pairing/pair-record.ts";
import { withClient } from "@device/infrastructure/closeable.ts";
import type { LockdownClient } from "@device/infrastructure/lockdown/client.ts";
import { createPairRecord } from "@device/infrastructure/pairing/certificates.ts";
import { compact, ErrorCode, LoadstarError } from "@loadstar/kernel";

type WaitingStage = "waiting_for_trust" | "waiting_for_unlock";

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

/** Generates certificates for the device's public key and has the user trust them. */
const createTrustedRecord = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  lockdown: LockdownClient,
  options: PairOptions,
): Promise<PairRecord> => {
  const devicePublicKey = await readDevicePublicKey(lockdown);
  const wifiMacAddress = await optionalString(lockdown, LOCKDOWN_WIFI_ADDRESS_KEY);
  const systemBuid = await ctx.usbmux.readBuid();
  const created = await createPairRecord({ devicePublicKey, systemBuid, now: ctx.deps.clock.now() });
  const escrowBag = await pairUntilTrusted(ctx, lockdown, created, options);
  return compact({ ...created, escrowBag, wifiMacAddress, udid: device.udid });
};

/**
 * Creates a pairing of Loadstar's own. The device shows "Trust This Computer?"; we keep asking until the user
 * answers, the device is unlocked, or `pairingTimeoutMs` passes. The record goes to the secret store only.
 */
export const pairWithOwnRecord = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  options: PairOptions,
): Promise<PairRecord> => {
  const record = await withClient(await openLockdown(ctx, device), (lockdown) =>
    createTrustedRecord(ctx, device, lockdown, options),
  );
  await saveOwnPairRecord(ctx, device.udid, record);
  reportPaired(ctx, device.udid, "secret_store", options);
  return record;
};
