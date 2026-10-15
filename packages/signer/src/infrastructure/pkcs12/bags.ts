// SafeBags (RFC 7292 §4.2): the certificate and the shrouded private key, tied together by localKeyId.
import {
  type Asn1,
  bmpString,
  explicit,
  octets,
  oid,
  sequence,
  set,
  sha1,
  toDer
} from '@signer/infrastructure/pkcs12/asn1.ts'
import {
  CONTENT_TAG,
  OID_CERT_BAG,
  OID_FRIENDLY_NAME,
  OID_LOCAL_KEY_ID,
  OID_SHROUDED_KEY_BAG,
  OID_X509_CERTIFICATE
} from '@signer/infrastructure/pkcs12/constants.ts'
import { pbeEncrypt } from '@signer/infrastructure/pkcs12/pbe.ts'

const attribute = (type: string, value: Asn1): Asn1 =>
  sequence([oid(type), set([value])])

/** localKeyId (SHA-1 of the certificate, as OpenSSL and Keychain write it) plus an optional friendlyName. */
export const bagAttributes = (
  certificate: string,
  friendlyName: string | undefined
): Asn1 => {
  const attributes = [attribute(OID_LOCAL_KEY_ID, octets(sha1(certificate)))]
  if (friendlyName !== undefined)
    attributes.push(attribute(OID_FRIENDLY_NAME, bmpString(friendlyName)))
  return set(attributes)
}

export const certificateBag = (certificate: string, attributes: Asn1): Asn1 =>
  sequence([
    oid(OID_CERT_BAG),
    explicit(
      CONTENT_TAG,
      sequence([
        oid(OID_X509_CERTIFICATE),
        explicit(CONTENT_TAG, octets(certificate))
      ])
    ),
    attributes
  ])

/** pkcs8ShroudedKeyBag: the PKCS#8 key as an EncryptedPrivateKeyInfo under the legacy PBE. */
export const shroudedKeyBag = (
  privateKey: string,
  password: string,
  attributes: Asn1
): Asn1 => {
  const { algorithm, ciphertext } = pbeEncrypt(privateKey, password)

  return sequence([
    oid(OID_SHROUDED_KEY_BAG),
    explicit(CONTENT_TAG, sequence([algorithm, octets(ciphertext)])),
    attributes
  ])
}

/** SafeContents: a SEQUENCE of bags, as DER bytes ready to wrap in a ContentInfo. */
export const safeContents = (bags: Asn1[]): string => toDer(sequence(bags))
