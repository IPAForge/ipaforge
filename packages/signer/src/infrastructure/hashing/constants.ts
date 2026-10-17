import type { HashAlgorithm } from '@signer/domain/ports/types.ts'

/** WebCrypto algorithm name of each hash algorithm. */
export const WEBCRYPTO_NAME: Readonly<Record<HashAlgorithm, string>> = {
  sha1: 'SHA-1',
  sha256: 'SHA-256'
}
