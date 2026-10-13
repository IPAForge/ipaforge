import { type HashAlgorithm, type Hasher, pageAt, pageCount } from "@signer/domain/ports/hasher.ts";

const WEBCRYPTO_NAME: Readonly<Record<HashAlgorithm, string>> = { sha1: "SHA-1", sha256: "SHA-256" };

/** Pages hashed concurrently per batch; bounds the number of in-flight promises. */
const BATCH = 256;

/** WebCrypto-backed hasher: fastest in browsers and good in Node (batched to amortise per-call cost). */
export const createWebCryptoHasher = (subtle: SubtleCrypto): Hasher => {
  const digest = async (algorithm: HashAlgorithm, data: Uint8Array): Promise<Uint8Array> =>
    new Uint8Array(await subtle.digest(WEBCRYPTO_NAME[algorithm], data as Uint8Array<ArrayBuffer>));

  return {
    kind: "webcrypto",
    digest,
    digestPages: async (algorithm, data, pageSize) => {
      const total = pageCount(data.byteLength, pageSize);
      const out: Uint8Array[] = new Array(total);
      for (let start = 0; start < total; start += BATCH) {
        const end = Math.min(start + BATCH, total);
        const batch = await Promise.all(
          Array.from({ length: end - start }, (_, k) => digest(algorithm, pageAt(data, start + k, pageSize))),
        );
        for (let k = 0; k < batch.length; k++) out[start + k] = batch[k] as Uint8Array;
      }
      return out;
    },
  };
};
