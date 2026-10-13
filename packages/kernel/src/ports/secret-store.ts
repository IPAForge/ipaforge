/**
 * Storage for credentials and private keys. Desktop: OS keychain via Electron `safeStorage`.
 * Web: in-memory for the session. Values are raw bytes; callers own the encoding.
 */
export interface SecretStore {
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, value: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
}
