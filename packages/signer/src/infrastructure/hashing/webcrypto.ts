import { pageAt, pageCount } from '@signer/domain/ports/hasher.ts'
import type { HashAlgorithm, Hasher } from '@signer/domain/ports/types.ts'
import { WEBCRYPTO_NAME } from '@signer/infrastructure/hashing/constants.ts'

export type WebCryptoHasherOptions = {
  /** Pages hashed concurrently per batch; bounds the number of in-flight promises (default 256). */
  readonly batchSize?: number
}

export const DEFAULT_WEBCRYPTO_BATCH_SIZE = 256

/** WebCrypto-backed hasher, the default (batched to amortise per-call cost). */
export const createWebCryptoHasher = (
  subtle: SubtleCrypto,
  options: WebCryptoHasherOptions = {}
): Hasher => {
  const batchSize = Math.max(
    1,
    Math.floor(options.batchSize ?? DEFAULT_WEBCRYPTO_BATCH_SIZE)
  )
  const digest = async (
    algorithm: HashAlgorithm,
    data: Uint8Array
  ): Promise<Uint8Array> =>
    new Uint8Array(
      await subtle.digest(
        WEBCRYPTO_NAME[algorithm],
        data as Uint8Array<ArrayBuffer>
      )
    )

  return {
    kind: 'webcrypto',
    digest,
    digestPages: async (algorithm, data, pageSize) => {
      const total = pageCount(data.byteLength, pageSize)
      const out: Uint8Array[] = new Array(total)
      for (let start = 0; start < total; start += batchSize) {
        const end = Math.min(start + batchSize, total)
        const batch = await Promise.all(
          Array.from({ length: end - start }, (_, k) =>
            digest(algorithm, pageAt(data, start + k, pageSize))
          )
        )
        for (let k = 0; k < batch.length; k++)
          out[start + k] = batch[k] as Uint8Array
      }
      return out
    }
  }
}
