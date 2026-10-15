import { ErrorCode, LoadstarError } from "@loadstar/kernel";
import { parseCertificate } from "@signer/infrastructure/cms/certificate.ts";
import { fromBinary, fromDer, integer, sequence, toBinary, toDer } from "@signer/infrastructure/pkcs12/asn1.ts";
import { bagAttributes, certificateBag, safeContents, shroudedKeyBag } from "@signer/infrastructure/pkcs12/bags.ts";
import { PFX_VERSION } from "@signer/infrastructure/pkcs12/constants.ts";
import { dataContent, encryptedContent } from "@signer/infrastructure/pkcs12/content-info.ts";
import { macData } from "@signer/infrastructure/pkcs12/mac.ts";

export interface Pkcs12Input {
  /** DER X.509 certificate. */
  readonly certificate: Uint8Array;
  /** PKCS#8 DER private key matching the certificate. */
  readonly privateKey: Uint8Array;
  readonly password: string;
  readonly friendlyName?: string;
}

const invalidInput = (message: string, cause: unknown): LoadstarError =>
  new LoadstarError(ErrorCode.InvalidCertificate, { message, cause });

const checkInput = (input: Pkcs12Input): void => {
  parseCertificate(input.certificate);
  try {
    fromDer(toBinary(input.privateKey));
  } catch (error) {
    throw invalidInput("private key is not PKCS#8 DER", error);
  }
};

/** PFX: certificates in an encryptedData safe, the shrouded key in a data safe, then the MAC. */
const buildPfx = (input: Pkcs12Input): string => {
  const certificate = toBinary(input.certificate);
  const attributes = bagAttributes(certificate, input.friendlyName);
  const authenticatedSafe = toDer(
    sequence([
      encryptedContent(safeContents([certificateBag(certificate, attributes)]), input.password),
      dataContent(safeContents([shroudedKeyBag(toBinary(input.privateKey), input.password, attributes)])),
    ]),
  );
  return toDer(
    sequence([integer(PFX_VERSION), dataContent(authenticatedSafe), macData(authenticatedSafe, input.password)]),
  );
};

/**
 * Exports a certificate and its private key as a password-protected PKCS#12 that iOS can import: both bags
 * under pbeWithSHAAnd3-KeyTripleDES-CBC and an HMAC-SHA1 MAC, at 2048 iterations (the "legacy" profile).
 */
export const exportPkcs12 = (input: Pkcs12Input): Uint8Array => {
  checkInput(input);
  try {
    return fromBinary(buildPfx(input));
  } catch (error) {
    throw invalidInput("could not build the PKCS#12 archive", error);
  }
};
