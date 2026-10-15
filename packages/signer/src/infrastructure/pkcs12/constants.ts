// PKCS#12 (RFC 7292) object identifiers and the legacy algorithm choices iOS can import. These are fixed by
// the standard and by what iOS's PKCS#12 import accepts; they are not configuration.

// Content types and bags
export const OID_ENCRYPTED_DATA = '1.2.840.113549.1.7.6'
export const OID_SHROUDED_KEY_BAG = '1.2.840.113549.1.12.10.1.2'
export const OID_CERT_BAG = '1.2.840.113549.1.12.10.1.3'
export const OID_X509_CERTIFICATE = '1.2.840.113549.1.9.22.1'

// Bag attributes (PKCS#9)
export const OID_FRIENDLY_NAME = '1.2.840.113549.1.9.20'
export const OID_LOCAL_KEY_ID = '1.2.840.113549.1.9.21'

/** pbeWithSHAAnd3-KeyTripleDES-CBC: the legacy PBE used for both the key bag and the certificate bag. */
export const OID_PBE_SHA1_3DES = '1.2.840.113549.1.12.1.3'
/** node-forge's name for the cipher behind OID_PBE_SHA1_3DES. */
export const PBE_CIPHER = '3DES-CBC'
export const PBE_KEY_BYTES = 24
export const PBE_IV_BYTES = 8
/** The MAC is HMAC-SHA1, so its key is one SHA-1 digest long. */
export const MAC_KEY_BYTES = 20
export const MAC_DIGEST = 'sha1'

/** Purpose IDs of the PKCS#12 key derivation (RFC 7292 appendix B.3). */
export const KDF_ENCRYPTION_KEY = 1
export const KDF_IV = 2
export const KDF_MAC_KEY = 3

/** Iteration count for the PBE and the MAC (OpenSSL's default, which iOS imports). */
export const PKCS12_ITERATIONS = 2048
export const PKCS12_SALT_BYTES = 8

export const PFX_VERSION = 3
export const ENCRYPTED_DATA_VERSION = 0
/** `[0]` tag of ContentInfo content, bag values, certValue and EncryptedContentInfo's encryptedContent. */
export const CONTENT_TAG = 0
