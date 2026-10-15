// Classifies installation_proxy failures. installd reports a symbolic `Error` plus a description that often
// carries an `0xe800xxxx` code; these decide which recovery the user is shown.
import { ErrorCode } from "@loadstar/kernel";

/** installd/MobileInstallation codes worth a dedicated recovery. */
export const InstalldCode = {
  /** A valid provisioning profile for this executable was not found (or the device registration is pending). */
  ProfileNotFound: "0xe8008015",
  /** The identity used to sign the executable is no longer valid (certificate revoked, team blocked, clock skew). */
  IdentityInvalid: "0xe8008018",
  /** The provisioning profile is banned (Apple blocked this Apple ID's team for sideloading on this device). */
  ProfileBanned: "0xe8008024",
} as const;

const CODE_TO_ERROR: Readonly<Record<string, ErrorCode>> = {
  [InstalldCode.ProfileNotFound]: ErrorCode.ProfileNotFound,
  [InstalldCode.IdentityInvalid]: ErrorCode.SigningIdentityInvalid,
  [InstalldCode.ProfileBanned]: ErrorCode.ProfileBanned,
};

const FREE_APP_LIMIT = /maximum number of installed apps using a free developer profile/i;
const HEX_CODE = /0x[0-9a-f]{8}/i;
const BUNDLE_SET = /\{\(([^)]*)\)\}/;

export interface InstallFailure {
  readonly code: ErrorCode;
  readonly installdCode?: string;
  /** For the free-profile limit: the application identifiers iOS counts against it (expired apps included). */
  readonly freeProfileApps?: readonly string[];
}

export const classifyInstallError = (error: string, description = ""): InstallFailure => {
  if (FREE_APP_LIMIT.test(description)) {
    const apps = BUNDLE_SET.exec(description)?.[1]
      ?.split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    return { code: ErrorCode.FreeAppLimit, ...(apps?.length ? { freeProfileApps: apps } : {}) };
  }
  const hex = HEX_CODE.exec(description)?.[0]?.toLowerCase() ?? HEX_CODE.exec(error)?.[0]?.toLowerCase();
  const mapped = hex ? CODE_TO_ERROR[hex] : undefined;
  return { code: mapped ?? ErrorCode.InstallFailed, ...(hex ? { installdCode: hex } : {}) };
};
