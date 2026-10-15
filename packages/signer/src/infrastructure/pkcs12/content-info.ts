// PKCS#7 ContentInfo wrappers for the AuthenticatedSafe: plain `data` and password-encrypted `encryptedData`.
import { OID_DATA } from '@signer/infrastructure/cms/oids.ts'
import {
  type Asn1,
  explicit,
  implicitOctets,
  integer,
  octets,
  oid,
  sequence
} from '@signer/infrastructure/pkcs12/asn1.ts'
import {
  CONTENT_TAG,
  ENCRYPTED_DATA_VERSION,
  OID_ENCRYPTED_DATA
} from '@signer/infrastructure/pkcs12/constants.ts'
import { pbeEncrypt } from '@signer/infrastructure/pkcs12/pbe.ts'

export const dataContent = (content: string): Asn1 =>
  sequence([oid(OID_DATA), explicit(CONTENT_TAG, octets(content))])

/** EncryptedData (RFC 5652 §8) under the legacy PBE. */
export const encryptedContent = (content: string, password: string): Asn1 => {
  const { algorithm, ciphertext } = pbeEncrypt(content, password)
  const encryptedContentInfo = sequence([
    oid(OID_DATA),
    algorithm,
    implicitOctets(CONTENT_TAG, ciphertext)
  ])

  return sequence([
    oid(OID_ENCRYPTED_DATA),
    explicit(
      CONTENT_TAG,
      sequence([integer(ENCRYPTED_DATA_VERSION), encryptedContentInfo])
    )
  ])
}
