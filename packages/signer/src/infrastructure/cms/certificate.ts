import { ErrorCode, LoadstarError } from "@loadstar/kernel";
import { OID_COMMON_NAME, OID_ORGANIZATIONAL_UNIT } from "@signer/infrastructure/cms/oids.ts";
import * as pkijs from "pkijs";

export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export const parseCertificate = (der: Uint8Array): pkijs.Certificate => {
  try {
    return pkijs.Certificate.fromBER(toArrayBuffer(der));
  } catch (error) {
    throw new LoadstarError(ErrorCode.InvalidCertificate, { message: "not a DER X.509 certificate", cause: error });
  }
};

const nameAttribute = (name: pkijs.RelativeDistinguishedNames, oid: string): string | undefined => {
  const value = name.typesAndValues.find((tv) => tv.type === oid)?.value;
  return typeof value?.valueBlock?.value === "string" ? value.valueBlock.value : undefined;
};

const nameDer = (name: pkijs.RelativeDistinguishedNames): Uint8Array => new Uint8Array(name.toSchema().toBER(false));

export interface CertificateInfo {
  readonly commonName: string | undefined;
  /** Subject OU: the Apple team ID for Apple-issued development certificates. */
  readonly organizationalUnit: string | undefined;
  readonly notAfter: Date;
  readonly subject: Uint8Array;
  readonly issuer: Uint8Array;
}

export const certificateInfo = (der: Uint8Array): CertificateInfo => {
  const cert = parseCertificate(der);
  return {
    commonName: nameAttribute(cert.subject, OID_COMMON_NAME),
    organizationalUnit: nameAttribute(cert.subject, OID_ORGANIZATIONAL_UNIT),
    notAfter: cert.notAfter.value,
    subject: nameDer(cert.subject),
    issuer: nameDer(cert.issuer),
  };
};
