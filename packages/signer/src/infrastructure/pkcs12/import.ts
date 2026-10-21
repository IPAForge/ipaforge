// Reads a .p12 (PKCS#12) file: the certificate and private key inside, for signing with a certificate made on another
// computer or by SideStore. node-forge does the reading: the legacy encryptions iOS and Keychain Access use (3DES,
// RC2), the newer PBES2 with AES that OpenSSL 3 writes, and the MAC (SHA-1 or SHA-2) that proves the password.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import { fromBinary, toBinary } from '@signer/infrastructure/pkcs12/asn1.ts'
import {
  OID_CERT_BAG,
  OID_KEY_BAG,
  OID_SHROUDED_KEY_BAG
} from '@signer/infrastructure/pkcs12/constants.ts'
import { forge } from '@signer/infrastructure/pkcs12/forge.ts'
import type {
  Asn1,
  Pkcs12Contents,
  RsaModulus
} from '@signer/infrastructure/pkcs12/types.ts'

/** A file bigger than any certificate and key could make is refused before it's read. */
const MAX_P12_BYTES = 256 * 1024

const invalid = (message: string, cause?: unknown): IPAForgeError =>
  new IPAForgeError(ErrorCode.InvalidCertificate, { message, cause })

/** The same RSA key: modulus and exponent. */
const sameKey = (a: RsaModulus, b: RsaModulus): boolean =>
  a.n.toString(16) === b.n.toString(16) &&
  a.e?.toString(16) === b.e?.toString(16)

const parseDer = (bytes: Uint8Array): Asn1 => {
  try {
    return forge.asn1.fromDer(toBinary(bytes))
  } catch (error) {
    throw invalid('not a .p12 file', error)
  }
}

const readPfx = (bytes: Uint8Array, password: string) => {
  const asn1 = parseDer(bytes)
  try {
    return forge.pkcs12.pkcs12FromAsn1(asn1, false, password)
  } catch (error) {
    // A wrong password fails the MAC, or (without one) decrypts to bytes that aren't a key.
    throw new IPAForgeError(ErrorCode.Pkcs12Password, {
      message: 'the .p12 did not open with this password',
      cause: error
    })
  }
}

/**
 * The private key in a .p12 and the serial number of its certificate (the one whose public key is the key's). Only
 * the serial: node-forge re-encodes a certificate it reads, so the certificate itself is taken from Apple, which
 * lists it for the team (`keyMatchesCertificate` checks the pair).
 * `signer.pkcs12_password` when the password doesn't open it; `signer.invalid_certificate` when it isn't a .p12, or
 * holds no private key with its certificate.
 */
export const importPkcs12 = (
  bytes: Uint8Array,
  password: string
): Pkcs12Contents => {
  if (bytes.byteLength > MAX_P12_BYTES) throw invalid('too large for a .p12')
  const pfx = readPfx(bytes, password)
  const keys = [OID_SHROUDED_KEY_BAG, OID_KEY_BAG].flatMap(
    (bagType) => pfx.getBags({ bagType })[bagType] ?? []
  )
  const certificates =
    pfx.getBags({ bagType: OID_CERT_BAG })[OID_CERT_BAG] ?? []
  for (const { key } of keys) {
    if (!key) continue
    const certificate = certificates.find(
      (bag) => bag.cert && sameKey(bag.cert.publicKey, key)
    )?.cert
    if (!certificate) continue

    return {
      serialNumber: certificate.serialNumber.toUpperCase().replace(/^0+/, ''),
      privateKey: fromBinary(
        forge.asn1
          .toDer(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(key)))
          .getBytes()
      )
    }
  }
  throw invalid('no private key with its certificate in the .p12')
}

/** Whether a PKCS#8 RSA private key is the one for a DER certificate's public key. */
export const keyMatchesCertificate = (
  privateKey: Uint8Array,
  certificate: Uint8Array
): boolean => {
  try {
    const key = forge.pki.privateKeyFromAsn1(
      forge.asn1.fromDer(toBinary(privateKey))
    )
    const parsed = forge.pki.certificateFromAsn1(
      forge.asn1.fromDer(toBinary(certificate))
    )

    return sameKey(parsed.publicKey, key)
  } catch {
    return false
  }
}
