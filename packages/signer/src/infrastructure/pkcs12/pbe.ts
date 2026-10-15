import { type Asn1, integer, octets, oid, sequence } from "@signer/infrastructure/pkcs12/asn1.ts";
import {
  KDF_ENCRYPTION_KEY,
  KDF_IV,
  OID_PBE_SHA1_3DES,
  PBE_CIPHER,
  PBE_IV_BYTES,
  PBE_KEY_BYTES,
  PKCS12_ITERATIONS,
  PKCS12_SALT_BYTES,
} from "@signer/infrastructure/pkcs12/constants.ts";
import { forge } from "@signer/infrastructure/pkcs12/forge.ts";
import { deriveKey, randomSalt } from "@signer/infrastructure/pkcs12/kdf.ts";

export interface PbeEncrypted {
  /** AlgorithmIdentifier: pbeWithSHAAnd3-KeyTripleDES-CBC with its salt and iteration count. */
  readonly algorithm: Asn1;
  readonly ciphertext: string;
}

const algorithmIdentifier = (salt: string): Asn1 =>
  sequence([oid(OID_PBE_SHA1_3DES), sequence([octets(salt), integer(PKCS12_ITERATIONS)])]);

/** Encrypts with the legacy PKCS#12 PBE (SHA-1 + three-key Triple DES, CBC) that iOS can import. */
export const pbeEncrypt = (plaintext: string, password: string): PbeEncrypted => {
  const salt = randomSalt(PKCS12_SALT_BYTES);
  const cipher = forge.cipher.createCipher(PBE_CIPHER, deriveKey(password, salt, KDF_ENCRYPTION_KEY, PBE_KEY_BYTES));
  cipher.start({ iv: deriveKey(password, salt, KDF_IV, PBE_IV_BYTES) });
  cipher.update(new forge.util.ByteBuffer(plaintext));
  cipher.finish();
  return { algorithm: algorithmIdentifier(salt), ciphertext: cipher.output.getBytes() };
};
