import { toBinary } from '@signer/infrastructure/pkcs12/asn1.ts'
import { PKCS12_ITERATIONS } from '@signer/infrastructure/pkcs12/constants.ts'
import { type ByteBuffer, forge } from '@signer/infrastructure/pkcs12/forge.ts'

/** PKCS#12 password-based key derivation (RFC 7292 appendix B) with SHA-1. */
export const deriveKey = (
  password: string,
  salt: string,
  purpose: number,
  length: number
): ByteBuffer =>
  forge.pki.pbe.generatePkcs12Key(
    password,
    new forge.util.ByteBuffer(salt),
    purpose,
    PKCS12_ITERATIONS,
    length
  )

/** A random salt from WebCrypto, as a node-forge binary string. */
export const randomSalt = (length: number): string =>
  toBinary(crypto.getRandomValues(new Uint8Array(length)))
