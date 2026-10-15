import { isBinaryPlist, parseBinaryPlist } from "@kernel/plist/binary-parse.ts";
import type { PlistLimits } from "@kernel/plist/limits.ts";
import type { PlistValue } from "@kernel/plist/model.ts";
import { parseXmlPlist } from "@kernel/plist/xml-parse.ts";

export { isBinaryPlist, parseBinaryPlist } from "@kernel/plist/binary-parse.ts";
export { DEFAULT_PLIST_LIMITS, type PlistLimits } from "@kernel/plist/limits.ts";
export {
  createDict,
  isPlistDict,
  type PlistDict,
  PlistReal,
  type PlistValue,
  real,
  stringAt,
  withKey,
} from "@kernel/plist/model.ts";
export { parseXmlPlist } from "@kernel/plist/xml-parse.ts";
export { serializeXmlPlist } from "@kernel/plist/xml-write.ts";

/** Parses an XML or binary plist, detected by content. */
export const parsePlist = (bytes: Uint8Array, limits?: PlistLimits): PlistValue =>
  isBinaryPlist(bytes) ? parseBinaryPlist(bytes, limits) : parseXmlPlist(bytes, limits);
