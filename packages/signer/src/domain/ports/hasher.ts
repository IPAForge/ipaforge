export type HashAlgorithm = "sha1" | "sha256";

export const DIGEST_SIZE: Readonly<Record<HashAlgorithm, number>> = { sha1: 20, sha256: 32 };

/** Hashing used by the signer. Async so the fast WebCrypto path can be used everywhere. */
export interface Hasher {
  readonly kind: string;
  digest(algorithm: HashAlgorithm, data: Uint8Array): Promise<Uint8Array>;
  /**
   * Hash `data` in `pageSize` chunks (code-directory page hashes). The last page is hashed
   * at its real length, never zero-padded.
   */
  digestPages(algorithm: HashAlgorithm, data: Uint8Array, pageSize: number): Promise<Uint8Array[]>;
}

export const pageCount = (length: number, pageSize: number): number => Math.ceil(length / pageSize);

export const pageAt = (data: Uint8Array, index: number, pageSize: number): Uint8Array =>
  data.subarray(index * pageSize, Math.min((index + 1) * pageSize, data.byteLength));
