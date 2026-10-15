// Test-only: self-signed "Apple Development"-shaped identities generated with WebCrypto + pkijs.
import { toBase64 } from "@loadstar/kernel";
import type { SigningIdentity } from "@signer/infrastructure/cms/index.ts";
import {
  OID_BASIC_CONSTRAINTS,
  OID_COMMON_NAME,
  OID_COUNTRY,
  OID_EKU_CODE_SIGNING,
  OID_EXTENDED_KEY_USAGE,
  OID_KEY_USAGE,
  OID_ORGANIZATION,
  OID_ORGANIZATIONAL_UNIT,
} from "@signer/infrastructure/cms/oids.ts";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

export interface TestIdentity extends SigningIdentity {
  readonly pem: string;
  readonly teamId: string;
  readonly commonName: string;
}

const rdn = (pairs: readonly [string, string][]): pkijs.RelativeDistinguishedNames =>
  new pkijs.RelativeDistinguishedNames({
    typesAndValues: pairs.map(
      ([type, value]) => new pkijs.AttributeTypeAndValue({ type, value: new asn1js.Utf8String({ value }) }),
    ),
  });

export interface TestIdentityOptions {
  readonly teamId?: string;
  readonly commonName?: string;
  /** Pretend the certificate was issued by this name (for chain-resolution tests). */
  readonly issuer?: pkijs.RelativeDistinguishedNames;
}

export const createTestIdentity = async (options: TestIdentityOptions = {}): Promise<TestIdentity> => {
  const teamId = options.teamId ?? "ABCDE12345";
  const commonName = options.commonName ?? `Apple Development: Loadstar Test (${teamId})`;
  const keys = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );

  const certificate = new pkijs.Certificate();
  certificate.version = 2;
  certificate.serialNumber = new asn1js.Integer({ value: Math.floor(Math.random() * 2 ** 31) + 1 });
  const subject = rdn([
    [OID_COUNTRY, "US"],
    [OID_ORGANIZATION, "Loadstar Test"],
    [OID_ORGANIZATIONAL_UNIT, teamId],
    [OID_COMMON_NAME, commonName],
  ]);
  certificate.subject = subject;
  certificate.issuer = options.issuer ?? subject;
  certificate.notBefore.value = new Date("2026-01-01T00:00:00Z");
  certificate.notAfter.value = new Date("2027-01-01T00:00:00Z");
  certificate.extensions = [
    new pkijs.Extension({
      extnID: OID_BASIC_CONSTRAINTS,
      critical: true,
      extnValue: new pkijs.BasicConstraints({ cA: false }).toSchema().toBER(false),
    }),
    new pkijs.Extension({
      // keyUsage: digitalSignature (bit 0) — required by the code-signing policy
      extnID: OID_KEY_USAGE,
      critical: true,
      extnValue: new asn1js.BitString({ valueHex: new Uint8Array([0x80]).buffer, unusedBits: 7 }).toBER(false),
    }),
    new pkijs.Extension({
      extnID: OID_EXTENDED_KEY_USAGE,
      critical: true,
      extnValue: new pkijs.ExtKeyUsage({ keyPurposes: [OID_EKU_CODE_SIGNING] }).toSchema().toBER(false),
    }),
  ];
  await certificate.subjectPublicKeyInfo.importKey(keys.publicKey);
  await certificate.sign(keys.privateKey, "SHA-256");

  const der = new Uint8Array(certificate.toSchema(true).toBER(false));
  const lines = toBase64(der).match(/.{1,64}/g) ?? [];
  const pem = `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
  return { certificate: der, chain: [], privateKey: keys.privateKey, pem, teamId, commonName };
};
