// Test-only: CMS-wrapped provisioning profiles shaped like Apple's free development profiles.

import { createDict, type PlistValue, serializeXmlPlist } from "@loadstar/kernel";
import type { TestIdentity } from "@signer/__tests__/identity.ts";
import { toArrayBuffer } from "@signer/infrastructure/cms/certificate.ts";
import { OID_DATA, OID_SIGNED_DATA } from "@signer/infrastructure/cms/oids.ts";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

export interface TestProfileOptions {
  readonly teamId: string;
  readonly bundleId: string; // without team prefix; may end in "*"
  readonly certificates: readonly Uint8Array[];
  readonly devices?: readonly string[];
  readonly expires?: Date;
  readonly extraEntitlements?: readonly [string, PlistValue][];
  readonly name?: string;
}

export const makeProfile = async (signer: TestIdentity, options: TestProfileOptions): Promise<Uint8Array> => {
  const entitlements = createDict([
    ["application-identifier", `${options.teamId}.${options.bundleId}`],
    ["com.apple.developer.team-identifier", options.teamId],
    ["get-task-allow", true],
    ["keychain-access-groups", [`${options.teamId}.*`]],
    ...(options.extraEntitlements ?? []),
  ]);
  const plist = serializeXmlPlist(
    createDict([
      ["AppIDName", `Loadstar ${options.bundleId}`],
      ["ApplicationIdentifierPrefix", [options.teamId]],
      ["CreationDate", new Date("2026-10-01T00:00:00Z")],
      ["DeveloperCertificates", [...options.certificates]],
      ["Entitlements", entitlements],
      ["ExpirationDate", options.expires ?? new Date("2026-10-20T00:00:00Z")],
      ["Name", options.name ?? `iOS Team Provisioning Profile: ${options.bundleId}`],
      ["Platform", ["iOS"]],
      ["ProvisionedDevices", [...(options.devices ?? ["00008110-000A1B2C3D4E5F60"])]],
      ["TeamIdentifier", [options.teamId]],
      ["TeamName", "Loadstar Test"],
      ["TimeToLive", 7],
      ["UUID", crypto.randomUUID().toUpperCase()],
      ["Version", 1],
    ]),
  );

  const leaf = pkijs.Certificate.fromBER(toArrayBuffer(signer.certificate));
  const signed = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({
      eContentType: OID_DATA,
      eContent: new asn1js.OctetString({ valueHex: toArrayBuffer(plist) }),
    }),
    certificates: [leaf],
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({ issuer: leaf.issuer, serialNumber: leaf.serialNumber }),
      }),
    ],
  });
  await signed.sign(signer.privateKey, 0, "SHA-256");
  return new Uint8Array(
    new pkijs.ContentInfo({ contentType: OID_SIGNED_DATA, content: signed.toSchema(true) }).toSchema().toBER(false),
  );
};
