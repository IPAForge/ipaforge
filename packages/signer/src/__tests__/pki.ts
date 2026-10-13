// Test-only: tiny PKI (roots, intermediates, leaves) built with WebCrypto + pkijs.
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

export interface TestCertificate {
  readonly der: Uint8Array;
  readonly cert: pkijs.Certificate;
  readonly privateKey: CryptoKey;
}

export interface CertificateSpec {
  readonly commonName: string;
  readonly organizationalUnit?: string;
  /** Signer of this certificate; omitted = self-signed. */
  readonly issuer?: TestCertificate;
  /** Name to write as issuer without actually being signed by it (forgery tests). */
  readonly claimedIssuer?: pkijs.RelativeDistinguishedNames;
  readonly ca?: boolean;
  /** AIA caIssuers URL. */
  readonly issuerUrl?: string;
  readonly notBefore?: Date;
  readonly notAfter?: Date;
}

const name = (commonName: string, ou?: string): pkijs.RelativeDistinguishedNames =>
  new pkijs.RelativeDistinguishedNames({
    typesAndValues: [
      ["2.5.4.6", "US"],
      ["2.5.4.10", "Loadstar Test"],
      ...(ou ? [["2.5.4.11", ou] as const] : []),
      ["2.5.4.3", commonName],
    ].map(([type, value]) => new pkijs.AttributeTypeAndValue({ type, value: new asn1js.Utf8String({ value }) })),
  });

const extension = (extnID: string, critical: boolean, value: { toSchema(): asn1js.AsnType } | asn1js.AsnType) =>
  new pkijs.Extension({
    extnID,
    critical,
    extnValue: ("toSchema" in value ? value.toSchema() : value).toBER(false),
  });

export const createCertificate = async (spec: CertificateSpec): Promise<TestCertificate> => {
  const keys = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const cert = new pkijs.Certificate();
  cert.version = 2;
  cert.serialNumber = new asn1js.Integer({ value: Math.floor(Math.random() * 2 ** 31) + 1 });
  cert.subject = name(spec.commonName, spec.organizationalUnit);
  cert.issuer = spec.claimedIssuer ?? spec.issuer?.cert.subject ?? cert.subject;
  cert.notBefore.value = spec.notBefore ?? new Date("2026-01-01T00:00:00Z");
  cert.notAfter.value = spec.notAfter ?? new Date("2030-01-01T00:00:00Z");

  const keyUsageBits = spec.ca ? 0x06 : 0x80; // keyCertSign|cRLSign : digitalSignature
  cert.extensions = [
    extension("2.5.29.19", true, new pkijs.BasicConstraints({ cA: spec.ca ?? false })),
    extension(
      "2.5.29.15",
      true,
      new asn1js.BitString({ valueHex: new Uint8Array([keyUsageBits]).buffer, unusedBits: 1 }),
    ),
    ...(spec.ca ? [] : [extension("2.5.29.37", true, new pkijs.ExtKeyUsage({ keyPurposes: ["1.3.6.1.5.5.7.3.3"] }))]),
    ...(spec.issuerUrl
      ? [
          extension(
            "1.3.6.1.5.5.7.1.1",
            false,
            new pkijs.InfoAccess({
              accessDescriptions: [
                new pkijs.AccessDescription({
                  accessMethod: "1.3.6.1.5.5.7.48.2",
                  accessLocation: new pkijs.GeneralName({ type: 6, value: spec.issuerUrl }),
                }),
              ],
            }),
          ),
        ]
      : []),
  ];
  await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
  await cert.sign(spec.issuer?.privateKey ?? keys.privateKey, "SHA-256");
  return { der: new Uint8Array(cert.toSchema(true).toBER(false)), cert, privateKey: keys.privateKey };
};
