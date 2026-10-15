import { isPlistDict, type PlistLimits, parsePlist, utf8Encode } from "@loadstar/kernel";

/** A provisioning profile installed on the device, as misagent returns it (summary only; the CMS is not verified). */
export interface DeviceProfile {
  readonly uuid: string;
  readonly name: string;
  readonly teamId?: string;
  readonly appIdName?: string;
  /** `application-identifier` entitlement, e.g. `ABCDE12345.com.example.app` (may contain `*`). */
  readonly applicationIdentifier?: string;
  readonly expirationDate?: Date;
  readonly raw: Uint8Array;
}

const XML_START = utf8Encode("<?xml");
const PLIST_END = utf8Encode("</plist>");

const indexOf = (haystack: Uint8Array, needle: Uint8Array, from = 0): number => {
  outer: for (let i = from; i <= haystack.byteLength - needle.byteLength; i++) {
    for (let j = 0; j < needle.byteLength; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
};

/** The XML plist embedded in a CMS-signed `.mobileprovision`, without parsing the CMS. */
export const embeddedProfilePlist = (profile: Uint8Array): Uint8Array | undefined => {
  const start = indexOf(profile, XML_START);
  if (start < 0) return undefined;
  const end = indexOf(profile, PLIST_END, start);
  if (end < 0) return undefined;
  return profile.subarray(start, end + PLIST_END.byteLength);
};

/** Summarises a profile, or returns `undefined` if it is not a readable provisioning profile. */
export const summarizeProfile = (raw: Uint8Array, limits?: PlistLimits): DeviceProfile | undefined => {
  const xml = embeddedProfilePlist(raw);
  if (!xml) return undefined;
  let value: ReturnType<typeof parsePlist>;
  try {
    value = parsePlist(xml, limits);
  } catch {
    return undefined;
  }
  if (!isPlistDict(value)) return undefined;
  const uuid = value.UUID;
  const name = value.Name;
  if (typeof uuid !== "string" || typeof name !== "string") return undefined;
  const team = Array.isArray(value.TeamIdentifier) ? value.TeamIdentifier[0] : undefined;
  const entitlements = isPlistDict(value.Entitlements) ? value.Entitlements : undefined;
  const appId = entitlements?.["application-identifier"];
  return {
    uuid,
    name,
    raw,
    ...(typeof team === "string" ? { teamId: team } : {}),
    ...(typeof value.AppIDName === "string" ? { appIdName: value.AppIDName } : {}),
    ...(typeof appId === "string" ? { applicationIdentifier: appId } : {}),
    ...(value.ExpirationDate instanceof Date ? { expirationDate: value.ExpirationDate } : {}),
  };
};

/** Bundle ID part of an application identifier (`TEAMID.com.example.app` → `com.example.app`). */
export const bundleIdOf = (applicationIdentifier: string): string => {
  const dot = applicationIdentifier.indexOf(".");
  return dot < 0 ? applicationIdentifier : applicationIdentifier.slice(dot + 1);
};
