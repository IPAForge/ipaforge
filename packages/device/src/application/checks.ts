import type { DeviceSession } from "@device/application/session.ts";
import { DEVELOPER_MODE_MIN_IOS, LockdownDomain } from "@device/domain/constants.ts";
import { type DeviceInfo, parseVersion } from "@device/domain/device.ts";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

export type DeveloperModeState = "on" | "off" | "not_required" | "unknown";

export interface DeviceCheck {
  readonly info: DeviceInfo;
  /** A passcode is set (installs still work; some services need the device unlocked once). */
  readonly passcodeSet: boolean;
  readonly developerMode: DeveloperModeState;
  readonly activated: boolean;
}

/** Classifies the AMFI `DeveloperModeStatus` value for a given iOS version. */
export const developerModeState = (productVersion: string, status: unknown): DeveloperModeState => {
  const [major] = parseVersion(productVersion);
  if (major < DEVELOPER_MODE_MIN_IOS) return "not_required";
  if (status === true) return "on";
  if (status === false) return "off";
  return "unknown";
};

export const checkDevice = async (session: DeviceSession): Promise<DeviceCheck> => {
  const info = await session.info();
  const status = await session.getValue("DeveloperModeStatus", LockdownDomain.Amfi).catch(() => undefined);
  return {
    info,
    passcodeSet: info.passwordProtected === true,
    developerMode: developerModeState(info.productVersion, status),
    activated: info.activationState === undefined || info.activationState === "Activated",
  };
};

/** Throws the catalogued error that blocks running sideloaded apps, if any. */
export const assertCanRunSideloadedApps = (check: DeviceCheck): void => {
  if (check.developerMode === "off") {
    throw new LoadstarError(ErrorCode.DeveloperModeOff, { data: { iosVersion: check.info.productVersion } });
  }
};
