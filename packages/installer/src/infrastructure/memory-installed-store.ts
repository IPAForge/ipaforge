import type { InstalledStore } from '@installer/domain/ports/installed-store.ts'

/** Keeps the installed-apps record in memory: for tests, and for hosts that don't save it. */
export const createMemoryInstalledStore = (): InstalledStore => {
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
