import { OID_SHA1 } from '@signer/infrastructure/cms/oids.ts'
import {
  type Asn1,
  integer,
  nullValue,
  octets,
  oid,
  sequence
} from '@signer/infrastructure/pkcs12/asn1.ts'
import {
  KDF_MAC_KEY,
  MAC_DIGEST,
  MAC_KEY_BYTES,
  PKCS12_ITERATIONS,
  PKCS12_SALT_BYTES
} from '@signer/infrastructure/pkcs12/constants.ts'
import { type ByteBuffer, forge } from '@signer/infrastructure/pkcs12/forge.ts'
import { deriveKey, randomSalt } from '@signer/infrastructure/pkcs12/kdf.ts'

const hmacSha1 = (key: ByteBuffer, content: string): string => {
  const hmac = forge.hmac.create()
  hmac.start(MAC_DIGEST, key)
  hmac.update(content)
  return hmac.getMac().getBytes()
}

/** MacData: HMAC-SHA1 over the AuthenticatedSafe bytes, keyed from the password. */
export const macData = (authenticatedSafe: string, password: string): Asn1 => {
  const salt = randomSalt(PKCS12_SALT_BYTES)
  const mac = hmacSha1(
    deriveKey(password, salt, KDF_MAC_KEY, MAC_KEY_BYTES),
    authenticatedSafe
  )
  const digestInfo = sequence([
    sequence([oid(OID_SHA1), nullValue()]),
    octets(mac)
  ])

  return sequence([digestInfo, octets(salt), integer(PKCS12_ITERATIONS)])
}
