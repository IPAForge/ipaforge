import type { DeviceContext } from "@device/application/context.ts";
import { getPairRecord, openLockdown, type PairOptions, pairDevice } from "@device/application/pair.ts";
import { LockdownDomain } from "@device/domain/constants.ts";
import { type DeviceInfo, shortUdid, type UsbmuxDevice } from "@device/domain/device.ts";
import { type PairRecord, tlsCredentials } from "@device/domain/pairing/pair-record.ts";
import type { Link } from "@device/infrastructure/framing/link.ts";
import type { LockdownClient } from "@device/infrastructure/lockdown/client.ts";
import { ErrorCode, isPlistDict, LoadstarError, type PlistValue } from "@loadstar/kernel";
import { z } from "zod";

export interface OpenSessionOptions extends PairOptions {
  /** Pair automatically (trust prompt) when there is no usable pair record. Default true. */
  readonly autoPair?: boolean;
}

export interface StartServiceOptions {
  /** Send the pair record's escrow bag (needed by some services while the device is locked). */
  readonly escrowBag?: boolean;
}

/** An open lockdown session with one device. Close it when done. */
export interface DeviceSession {
  readonly device: UsbmuxDevice;
  readonly pairRecord: PairRecord;
  info(): Promise<DeviceInfo>;
  getValue(key?: string, domain?: string): Promise<PlistValue | undefined>;
  setValue(domain: string, key: string, value: PlistValue): Promise<void>;
  /** Starts `service` and returns a new connection to it (TLS when the device asks for it). */
  startService(service: string, options?: StartServiceOptions): Promise<Link>;
  /**
   * Lets the device be reached over Wi-Fi/VPN (SideStore and StikDebug use the pairing file this way).
   * lockdownd answers `MissingValue` when no passcode is set → `device.passcode_required`.
   */
  enableWifiDebugging(): Promise<void>;
  close(): Promise<void>;
}

const deviceInfoSchema = z.looseObject({
  UniqueDeviceID: z.string(),
  DeviceName: z.string(),
  ProductType: z.string(),
  ProductVersion: z.string(),
  BuildVersion: z.string(),
  DeviceClass: z.string(),
  CPUArchitecture: z.string().optional(),
  ActivationState: z.string().optional(),
  PasswordProtected: z.boolean().optional(),
});

export const toDeviceInfo = (values: PlistValue | undefined): DeviceInfo => {
  const parsed = deviceInfoSchema.safeParse(isPlistDict(values) ? values : undefined);
  if (!parsed.success) {
    throw new LoadstarError(ErrorCode.DeviceProtocolError, {
      message: "unexpected device values",
      cause: parsed.error,
    });
  }
  const v = parsed.data;
  return {
    udid: v.UniqueDeviceID,
    name: v.DeviceName,
    productType: v.ProductType,
    productVersion: v.ProductVersion,
    buildVersion: v.BuildVersion,
    deviceClass: v.DeviceClass,
    ...(v.CPUArchitecture ? { cpuArchitecture: v.CPUArchitecture } : {}),
    ...(v.ActivationState ? { activationState: v.ActivationState } : {}),
    ...(v.PasswordProtected === undefined ? {} : { locked: v.PasswordProtected }),
  };
};

const isInvalidPairing = (error: unknown): boolean =>
  error instanceof LoadstarError && error.code === ErrorCode.InvalidPairRecord;

const startSession = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  record: PairRecord,
): Promise<{ lockdown: LockdownClient; sessionId: string }> => {
  const lockdown = await openLockdown(ctx, device);
  try {
    const { sessionId, enableSessionSsl } = await lockdown.startSession(record.hostId, record.systemBuid);
    if (enableSessionSsl) await lockdown.startTls(tlsCredentials(record));
    return { lockdown, sessionId };
  } catch (error) {
    await lockdown.close();
    throw error;
  }
};

/**
 * Opens a lockdown session. A missing or rejected pair record triggers pairing (once) unless
 * `autoPair` is false, in which case `device.not_paired` / `device.invalid_pair_record` is thrown.
 */
export const openSession = async (
  ctx: DeviceContext,
  device: UsbmuxDevice,
  options: OpenSessionOptions = {},
): Promise<DeviceSession> => {
  const { logger } = ctx.deps;
  const autoPair = options.autoPair ?? true;

  let record = await getPairRecord(ctx, device.udid);
  if (!record) {
    if (!autoPair) throw new LoadstarError(ErrorCode.DeviceNotPaired, { data: { device: shortUdid(device.udid) } });
    record = await pairDevice(ctx, device, options);
  }

  let started: { lockdown: LockdownClient; sessionId: string };
  try {
    started = await startSession(ctx, device, record);
  } catch (error) {
    if (!isInvalidPairing(error) || !autoPair) throw error;
    logger.warn("the device rejected the pair record; pairing again", { device: shortUdid(device.udid) });
    record = await pairDevice(ctx, device, options);
    started = await startSession(ctx, device, record);
  }
  const { lockdown, sessionId } = started;
  const pairRecord = record;
  const credentials = tlsCredentials(pairRecord);
  logger.info("session opened", { device: shortUdid(device.udid) });

  let closed = false;
  return {
    device,
    pairRecord,
    info: async () => toDeviceInfo(await lockdown.getValue()),
    getValue: (key, domain) => lockdown.getValue(key, domain),
    setValue: (domain, key, value) => lockdown.setValue(domain, key, value),
    startService: async (service, serviceOptions = {}) => {
      const { port, enableServiceSsl } = await lockdown.startService(
        service,
        serviceOptions.escrowBag ? pairRecord.escrowBag : undefined,
      );
      const link = await ctx.usbmux.connect(device.deviceId, port);
      try {
        if (enableServiceSsl) await link.startTls(credentials);
        return link;
      } catch (error) {
        await link.close();
        throw error;
      }
    },
    enableWifiDebugging: async () => {
      try {
        await lockdown.setValue(LockdownDomain.WirelessLockdown, "EnableWifiDebugging", true);
      } catch (error) {
        if (error instanceof LoadstarError && error.data?.lockdownError === "MissingValue") {
          throw new LoadstarError(ErrorCode.PasscodeRequired, { cause: error });
        }
        throw error;
      }
    },
    close: async () => {
      if (closed) return;
      closed = true;
      try {
        await lockdown.stopSession(sessionId);
      } catch (error) {
        logger.debug("StopSession failed (ignored)", { cause: error });
      } finally {
        await lockdown.close();
        logger.info("session closed", { device: shortUdid(device.udid) });
      }
    },
  };
};
