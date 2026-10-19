/**
 * Where the list of app sources and each one's last good copy are kept (desktop: a file in the app's data folder).
 * Nothing secret goes here. Values are raw bytes; the sources service owns their encoding.
 */
export type SourceStore = {
  get(key: string): Promise<Uint8Array | undefined>
  set(key: string, value: Uint8Array): Promise<void>
  delete(key: string): Promise<void>
}
