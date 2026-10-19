/**
 * Where the Engine remembers the apps it installed, per device (desktop: a file in the app's data folder). Nothing
 * secret goes here. Values are raw bytes; the installed-apps service owns their encoding.
 */
export type InstalledStore = {
  get(key: string): Promise<Uint8Array | undefined>
  set(key: string, value: Uint8Array): Promise<void>
  delete(key: string): Promise<void>
}
