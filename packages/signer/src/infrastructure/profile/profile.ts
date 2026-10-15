import { ErrorCode, equalBytes, LoadstarError } from "@loadstar/kernel";
import { DEFAULT_SIGNER_LIMITS, type PlistLimits } from "@signer/domain/config.ts";
import { isPlistDict, type PlistDict, parseXmlPlist } from "@signer/domain/plist/index.ts";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";
import { z } from "zod";

/** A parsed `embedded.mobileprovision`. */
export interface ProvisioningProfile {
  readonly name: string;
  readonly uuid: string;
  readonly teamId: string;
  readonly applicationIdentifier: string;
  readonly entitlements: PlistDict;
  readonly developerCertificates: readonly Uint8Array[];
  readonly provisionedDevices: readonly string[];
  readonly provisionsAllDevices: boolean;
  readonly creationDate: Date;
  readonly expirationDate: Date;
  /** The original profile bytes (written into the bundle as-is). */
  readonly raw: Uint8Array;
}

const plistDict = z.custom<PlistDict>((value) => isPlistDict(value as never), "expected a dictionary");
const bytes = z.custom<Uint8Array>((value) => value instanceof Uint8Array, "expected data");

const ProfileSchema = z.object({
  Name: z.string(),
  UUID: z.string(),
  TeamIdentifier: z.array(z.string()).min(1),
  CreationDate: z.date(),
  ExpirationDate: z.date(),
  Entitlements: plistDict,
  DeveloperCertificates: z.array(bytes),
  ProvisionedDevices: z.array(z.string()).optional(),
  ProvisionsAllDevices: z.boolean().optional(),
});

const invalid = (message: string, cause?: unknown): LoadstarError =>
  new LoadstarError(ErrorCode.InvalidProfile, { message, ...(cause ? { cause } : {}) });

/** The XML plist inside the CMS envelope; tolerant of BER/indefinite encodings. */
const extractPlist = (raw: Uint8Array): Uint8Array => {
  try {
    const contentInfo = pkijs.ContentInfo.fromBER(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer,
    );
    const signed = new pkijs.SignedData({ schema: contentInfo.content });
    const content = signed.encapContentInfo.eContent;
    if (content instanceof asn1js.OctetString) return new Uint8Array(content.getValue());
  } catch {
    // fall through to the textual fallback
  }
  // Fallback: the payload is a UTF-8 XML plist; take it verbatim from the envelope.
  const text = new TextDecoder("latin1").decode(raw);
  const start = text.indexOf("<?xml");
  const end = text.indexOf("</plist>", start);
  if (start < 0 || end < 0) throw invalid("no property list inside the provisioning profile");
  return raw.slice(start, end + "</plist>".length);
};

export const parseProvisioningProfile = (
  raw: Uint8Array,
  limits: PlistLimits = DEFAULT_SIGNER_LIMITS.plist,
): ProvisioningProfile => {
  const plistBytes = extractPlist(raw);
  let value: unknown;
  try {
    value = parseXmlPlist(plistBytes, limits);
  } catch (error) {
    throw invalid("provisioning profile plist is malformed", error);
  }
  const parsed = ProfileSchema.safeParse(value);
  if (!parsed.success) throw invalid(`provisioning profile is missing fields: ${z.prettifyError(parsed.error)}`);

  const p = parsed.data;
  const applicationIdentifier = p.Entitlements["application-identifier"];
  if (typeof applicationIdentifier !== "string") throw invalid("profile entitlements lack application-identifier");
  return {
    name: p.Name,
    uuid: p.UUID,
    teamId: p.TeamIdentifier[0] as string,
    applicationIdentifier,
    entitlements: p.Entitlements,
    developerCertificates: p.DeveloperCertificates,
    provisionedDevices: p.ProvisionedDevices ?? [],
    provisionsAllDevices: p.ProvisionsAllDevices ?? false,
    creationDate: p.CreationDate,
    expirationDate: p.ExpirationDate,
    raw,
  };
};

/** Does the profile's application-identifier (exact or `TEAM.*` / `TEAM.prefix.*`) cover `bundleId`? */
export const profileCoversBundle = (profile: ProvisioningProfile, bundleId: string): boolean => {
  const wanted = `${profile.teamId}.${bundleId}`;
  const pattern = profile.applicationIdentifier;
  return pattern === wanted || (pattern.endsWith("*") && wanted.startsWith(pattern.slice(0, -1)));
};

export const profileContainsCertificate = (profile: ProvisioningProfile, certificate: Uint8Array): boolean =>
  profile.developerCertificates.some((candidate) => equalBytes(candidate, certificate));

export const describeProfile = (profile: ProvisioningProfile): string =>
  `${profile.name} (${profile.uuid}, team ${profile.teamId}, expires ${profile.expirationDate.toISOString()})`;
