import type { HashAlgorithm } from '@signer/domain/ports/types.ts'

/** Digest length in bytes of each hash algorithm. */
export const DIGEST_SIZE: Readonly<Record<HashAlgorithm, number>> = {
  sha1: 20,
  sha256: 32
}
