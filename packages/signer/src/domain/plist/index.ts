import type { PlistLimits } from "@signer/domain/config.ts";
import { isBinaryPlist, parseBinaryPlist } from "@signer/domain/plist/binary-parse.ts";
import type { PlistValue } from "@signer/domain/plist/model.ts";
import { parseXmlPlist } from "@signer/domain/plist/xml-parse.ts";

export { isBinaryPlist, parseBinaryPlist } from "@signer/domain/plist/binary-parse.ts";
export {
  createDict,
  isPlistDict,
  type PlistDict,
  PlistReal,
  type PlistValue,
  real,
  stringAt,
  withKey,
} from "@signer/domain/plist/model.ts";
export { parseXmlPlist } from "@signer/domain/plist/xml-parse.ts";
export { serializeXmlPlist } from "@signer/domain/plist/xml-write.ts";

/** Parses an XML or binary plist, detected by content. */
export const parsePlist = (bytes: Uint8Array, limits?: PlistLimits): PlistValue =>
  isBinaryPlist(bytes) ? parseBinaryPlist(bytes, limits) : parseXmlPlist(bytes, limits);
