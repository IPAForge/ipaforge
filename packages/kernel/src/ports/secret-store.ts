/**
 * Storage for credentials and private keys, backed by the OS keychain via Electron `safeStorage`.
 * Values are raw bytes; callers own the encoding.
 */
export type SecretStore = {
  get(key: string): Promise<Uint8Array | undefined>
  set(key: string, value: Uint8Array): Promise<void>
  delete(key: string): Promise<void>
}
