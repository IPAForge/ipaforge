import { sha1 } from '@noble/hashes/legacy.js'
import { sha256 } from '@noble/hashes/sha2.js'

import {
  type HashAlgorithm,
  type Hasher,
  pageAt,
  pageCount
} from '@signer/domain/ports/hasher.ts'

const HASH: Readonly<Record<HashAlgorithm, (data: Uint8Array) => Uint8Array>> =
  { sha1, sha256 }

/** Pure-JS hasher: the fallback when WebCrypto is unavailable (slower). */
export const createNobleHasher = (): Hasher => ({
  kind: 'noble',
  digest: async (algorithm, data) => HASH[algorithm](data),
  digestPages: async (algorithm, data, pageSize) =>
    Array.from({ length: pageCount(data.byteLength, pageSize) }, (_, i) =>
      HASH[algorithm](pageAt(data, i, pageSize))
    )
})
