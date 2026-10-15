// A PKCS#10 certificate signing request for a development certificate: RSA-2048, SHA-256, created with WebCrypto
// and pkijs. The private key never leaves this computer except through an explicit user export.
import { toBase64 } from "@loadstar/kernel";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

const OID_COMMON_NAME = "2.5.4.3";
const OID_COUNTRY = "2.5.4.6";
const RSA_KEY_BITS = 2048;
const PEM_LINE_WIDTH = 64;

const pem = (label: string, der: ArrayBuffer): string => {
  const base64 = toBase64(new Uint8Array(der));
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += PEM_LINE_WIDTH) lines.push(base64.slice(i, i + PEM_LINE_WIDTH));
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
};

export interface CertificateRequest {
  /** PEM, as `submitDevelopmentCSR` expects in `csrContent`. */
  readonly csrPem: string;
  /** PKCS#8 DER: keep it with the certificate (it is the only copy). */
  readonly privateKey: Uint8Array;
}

export const createCertificateRequest = async (
  commonName: string,
  crypto: Crypto = globalThis.crypto,
): Promise<CertificateRequest> => {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: RSA_KEY_BITS,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const request = new pkijs.CertificationRequest();
  request.version = 0;
  request.subject.typesAndValues.push(
    new pkijs.AttributeTypeAndValue({ type: OID_COUNTRY, value: new asn1js.PrintableString({ value: "US" }) }),
    new pkijs.AttributeTypeAndValue({ type: OID_COMMON_NAME, value: new asn1js.Utf8String({ value: commonName }) }),
  );
  await request.subjectPublicKeyInfo.importKey(keys.publicKey, new pkijs.CryptoEngine({ crypto }));
  await request.sign(keys.privateKey, "SHA-256", new pkijs.CryptoEngine({ crypto }));
  return {
    csrPem: pem("CERTIFICATE REQUEST", request.toSchema().toBER(false)),
    privateKey: new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey)),
  };
};
