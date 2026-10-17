import type { Hasher } from '@signer/domain/ports/types.ts'
import { createNobleHasher } from '@signer/infrastructure/hashing/noble.ts'
import {
  createWebCryptoHasher,
  type WebCryptoHasherOptions
} from '@signer/infrastructure/hashing/webcrypto.ts'

export { DIGEST_SIZE } from '@signer/domain/ports/constants.ts'
export { pageAt, pageCount } from '@signer/domain/ports/hasher.ts'
export type { HashAlgorithm, Hasher } from '@signer/domain/ports/types.ts'
export { createNobleHasher } from '@signer/infrastructure/hashing/noble.ts'
export {
  createWebCryptoHasher,
  DEFAULT_WEBCRYPTO_BATCH_SIZE,
  type WebCryptoHasherOptions
} from '@signer/infrastructure/hashing/webcrypto.ts'

/** WebCrypto when available (secure contexts, Node), otherwise the pure-JS fallback. */
export const createHasher = (options: WebCryptoHasherOptions = {}): Hasher => {
  const subtle = globalThis.crypto?.subtle

  return subtle ? createWebCryptoHasher(subtle, options) : createNobleHasher()
}
