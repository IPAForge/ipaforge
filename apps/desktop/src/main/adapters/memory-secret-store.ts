// In-memory SecretStore for the device probe and tests. Phase 9 replaces it with a keychain-backed store
// (Electron safeStorage master key + encrypted file store, see references/failure-catalogue.md).
import type { SecretStore } from '@ipaforge/kernel'

export const createMemorySecretStore = (): SecretStore => {
  const values = new Map<string, Uint8Array>()

  return {
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value.slice())
    },
    delete: async (key) => {
      values.delete(key)
    }
  }
}
