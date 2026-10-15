import { compareBytes, ErrorCode, LoadstarError } from "@loadstar/kernel";
import { createDict } from "@signer/domain/plist/index.ts";
import { serializeXmlPlist } from "@signer/domain/plist/xml-write.ts";
import type { HashAlgorithm, Hasher } from "@signer/domain/ports/hasher.ts";
import { parseCertificate, toArrayBuffer } from "@signer/infrastructure/cms/certificate.ts";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

const OID_DATA = "1.2.840.113549.1.7.1";
const OID_SIGNED_DATA = "1.2.840.113549.1.7.2";
const OID_CONTENT_TYPE = "1.2.840.113549.1.9.3";
const OID_MESSAGE_DIGEST = "1.2.840.113549.1.9.4";
const OID_SIGNING_TIME = "1.2.840.113549.1.9.5";
const OID_APPLE_CDHASHES = "1.2.840.113635.100.9.1";
const OID_SHA256_WITH_RSA = "1.2.840.113549.1.1.11";
const OID_APPLE_CDHASHES2 = "1.2.840.113635.100.9.2";
const DIGEST_OID: Readonly<Record<HashAlgorithm, string>> = { sha1: "1.3.14.3.2.26", sha256: "2.16.840.1.101.3.4.2.1" };

export interface SigningIdentity {
  /** Leaf certificate (DER). */
  readonly certificate: Uint8Array;
  /** Intermediate(s) + root to embed, issuer-first after the leaf. */
  readonly chain: readonly Uint8Array[];
  /** RSASSA-PKCS1-v1_5/SHA-256 or ECDSA/SHA-256 signing key. */
  readonly privateKey: CryptoKey;
}

export interface SignedCodeDirectory {
  readonly bytes: Uint8Array;
  readonly algorithm: HashAlgorithm;
}

/** UTCTime for 1950–2049, GeneralizedTime otherwise (RFC 5652 §11.3). */
const signingTimeValue = (date: Date): asn1js.UTCTime | asn1js.GeneralizedTime => {
  const year = date.getUTCFullYear();
  const truncated = new Date(Math.floor(date.getTime() / 1000) * 1000);
  return year >= 1950 && year < 2050
    ? new asn1js.UTCTime({ valueDate: truncated })
    : new asn1js.GeneralizedTime({ valueDate: truncated });
};

const attributeDer = (attribute: pkijs.Attribute): Uint8Array => new Uint8Array(attribute.toSchema().toBER(false));

/** DER `SET OF`: elements sorted by their encodings. */
const derSorted = <T>(items: readonly T[], encode: (item: T) => Uint8Array): T[] =>
  items
    .map((item) => ({ item, der: encode(item) }))
    .sort((a, b) => compareBytes(a.der, b.der))
    .map(({ item }) => item);

/**
 * Detached CMS SignedData over the primary CodeDirectory, with Apple's cdhash attributes
 * (signer-spec §5). `codeDirectories` lists every CD in the SuperBlob, primary first.
 */
export const signCodeDirectories = async (
  codeDirectories: readonly SignedCodeDirectory[],
  identity: SigningIdentity,
  signingTime: Date,
  hasher: Hasher,
): Promise<Uint8Array> => {
  const primary = codeDirectories[0];
  if (!primary) throw new LoadstarError(ErrorCode.Unexpected, { message: "no CodeDirectory to sign" });

  const fullHashes = await Promise.all(codeDirectories.map((cd) => hasher.digest(cd.algorithm, cd.bytes)));
  const cdhashesPlist = serializeXmlPlist(createDict([["cdhashes", fullHashes.map((h) => h.slice(0, 20))]]));
  const messageDigest = await hasher.digest("sha256", primary.bytes);

  const cdhashes2Values = derSorted(
    codeDirectories.map(
      (cd, i) =>
        new asn1js.Sequence({
          value: [
            new asn1js.ObjectIdentifier({ value: DIGEST_OID[cd.algorithm] }),
            new asn1js.OctetString({ valueHex: toArrayBuffer(fullHashes[i] as Uint8Array) }),
          ],
        }),
    ),
    (value) => new Uint8Array(value.toBER(false)),
  );

  const attributes = derSorted(
    [
      new pkijs.Attribute({ type: OID_CONTENT_TYPE, values: [new asn1js.ObjectIdentifier({ value: OID_DATA })] }),
      new pkijs.Attribute({ type: OID_SIGNING_TIME, values: [signingTimeValue(signingTime)] }),
      new pkijs.Attribute({
        type: OID_MESSAGE_DIGEST,
        values: [new asn1js.OctetString({ valueHex: toArrayBuffer(messageDigest) })],
      }),
      new pkijs.Attribute({ type: OID_APPLE_CDHASHES2, values: cdhashes2Values }),
      new pkijs.Attribute({
        type: OID_APPLE_CDHASHES,
        values: [new asn1js.OctetString({ valueHex: toArrayBuffer(cdhashesPlist) })],
      }),
    ],
    attributeDer,
  );

  const leaf = parseCertificate(identity.certificate);
  const signedData = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: OID_DATA }),
    // certificates [0] IMPLICIT SET: DER-sorted like any SET OF (verified against codesign with a real
    // Apple Development certificate: G3, Apple Root CA, then the leaf)
    certificates: derSorted(
      [leaf, ...identity.chain.map(parseCertificate)],
      (cert) => new Uint8Array(cert.toSchema(true).toBER(false)),
    ),
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({ issuer: leaf.issuer, serialNumber: leaf.serialNumber }),
        signedAttrs: new pkijs.SignedAndUnsignedAttributes({ type: 0, attributes }),
      }),
    ],
  });

  try {
    await signedData.sign(identity.privateKey, 0, "SHA-256", toArrayBuffer(primary.bytes));
    // Apple writes sha256WithRSAEncryption with an explicit NULL parameter (pkijs omits it). The signature
    // covers only the signed attributes, so adjusting this identifier afterwards is safe.
    const signer = signedData.signerInfos[0];
    if (signer && signer.signatureAlgorithm.algorithmId === OID_SHA256_WITH_RSA) {
      signer.signatureAlgorithm = new pkijs.AlgorithmIdentifier({
        algorithmId: OID_SHA256_WITH_RSA,
        algorithmParams: new asn1js.Null(),
      });
    }
  } catch (error) {
    throw new LoadstarError(ErrorCode.InvalidCertificate, { message: "CMS signing failed", cause: error });
  }
  const contentInfo = new pkijs.ContentInfo({ contentType: OID_SIGNED_DATA, content: signedData.toSchema(true) });
  return new Uint8Array(contentInfo.toSchema().toBER(false));
};
