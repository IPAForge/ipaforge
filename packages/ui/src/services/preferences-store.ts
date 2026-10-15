/**
 * Where UI preferences (palette, colour mode, later the language) are kept between launches.
 * Synchronous so the first frame already renders with the saved theme. Provided by the host:
 * localStorage in a browser (`createLocalStoragePreferences`), the Electron renderer later.
 */
export interface PreferencesStore {
  read: (key: string) => string | undefined;
  write: (key: string, value: string) => void;
}

/** An in-memory store: the default for tests and for hosts that don't persist anything. */
export const createMemoryPreferencesStore = (initial: Readonly<Record<string, string>> = {}): PreferencesStore => {
  const values = new Map(Object.entries(initial));
  return {
    read: (key) => values.get(key),
    write: (key, value) => {
      values.set(key, value);
    },
  };
};
