/** Key/value cache for downloads and API responses. Expired entries behave as missing. */
export interface Cache {
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, value: Uint8Array, options?: { readonly ttlMs?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
