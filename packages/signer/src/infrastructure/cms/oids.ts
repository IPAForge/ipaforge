// Object identifiers used by the signer, in one place. These are fixed by the standards (RFC 5652, X.509)
// and by Apple's code-signing format; they are not configuration.

import type { HashAlgorithm } from '@signer/domain/ports/types.ts'

// CMS (RFC 5652)
export const OID_DATA = '1.2.840.113549.1.7.1'
export const OID_SIGNED_DATA = '1.2.840.113549.1.7.2'
export const OID_CONTENT_TYPE = '1.2.840.113549.1.9.3'
export const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4'
export const OID_SIGNING_TIME = '1.2.840.113549.1.9.5'

// Apple code-signing CMS attributes
export const OID_APPLE_CDHASHES = '1.2.840.113635.100.9.1' // plist of truncated cdhashes
export const OID_APPLE_CDHASHES2 = '1.2.840.113635.100.9.2' // SEQUENCE { digest OID, full digest } per CD

// Algorithms
export const OID_SHA1 = '1.3.14.3.2.26'
export const OID_SHA256 = '2.16.840.1.101.3.4.2.1'
export const OID_SHA256_WITH_RSA = '1.2.840.113549.1.1.11'

// X.509 names and extensions
export const OID_COUNTRY = '2.5.4.6'
export const OID_ORGANIZATION = '2.5.4.10'
export const OID_COMMON_NAME = '2.5.4.3'
export const OID_ORGANIZATIONAL_UNIT = '2.5.4.11'
export const OID_KEY_USAGE = '2.5.29.15'
export const OID_BASIC_CONSTRAINTS = '2.5.29.19'
export const OID_EXTENDED_KEY_USAGE = '2.5.29.37'
export const OID_AUTHORITY_INFO_ACCESS = '1.3.6.1.5.5.7.1.1'
export const OID_AIA_CA_ISSUERS = '1.3.6.1.5.5.7.48.2'
export const OID_EKU_CODE_SIGNING = '1.3.6.1.5.5.7.3.3'

// Apple certificate markers
/** Present on Apple WWDR intermediates; Apple's designated requirement checks for it. */
export const OID_APPLE_WWDR_INTERMEDIATE = '1.2.840.113635.100.6.2.1'

/** Digest algorithm OID of each hash algorithm. */
export const DIGEST_OID: Readonly<Record<HashAlgorithm, string>> = {
  sha1: OID_SHA1,
  sha256: OID_SHA256
}
