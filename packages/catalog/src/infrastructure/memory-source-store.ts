import type { SourceStore } from '@catalog/domain/ports/source-store.ts'

/** Keeps app sources in memory: for tests, and for hosts that don't save them. */
export const createMemorySourceStore = (): SourceStore => {
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
