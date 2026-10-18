import type { PreferencesStore } from '@ui/services/preferences/preferences-store.ts'

const KEY_PREFIX = 'ipaforge.'

/**
 * `PreferencesStore` over the browser's localStorage. Storage can throw (blocked site data, quota);
 * a preference that can't be read or saved simply falls back to its default.
 */
export const createLocalStoragePreferences = (
  storage: Storage
): PreferencesStore => ({
  read: (key) => {
    try {
      return storage.getItem(KEY_PREFIX + key) ?? undefined
    } catch {
      return undefined
    }
  },
  write: (key, value) => {
    try {
      storage.setItem(KEY_PREFIX + key, value)
    } catch {
      // not persisting is harmless; the in-memory theme state still applies
    }
  }
})
