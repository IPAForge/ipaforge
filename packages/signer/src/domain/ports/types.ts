export type HashAlgorithm = 'sha1' | 'sha256'

/** Hashing used by the signer. Async so the fast WebCrypto path can be used everywhere. */
export type Hasher = {
  readonly kind: string
  digest(algorithm: HashAlgorithm, data: Uint8Array): Promise<Uint8Array>
  /**
   * Hash `data` in `pageSize` chunks (code-directory page hashes). The last page is hashed
   * at its real length, never zero-padded.
   */
  digestPages(
    algorithm: HashAlgorithm,
    data: Uint8Array,
    pageSize: number
  ): Promise<Uint8Array[]>
}
