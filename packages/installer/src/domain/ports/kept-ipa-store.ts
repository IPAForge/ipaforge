import type { FileSource } from '@ipaforge/kernel'

/**
 * Where the original (unsigned) IPA of every installed app is kept, so it can be signed again before it expires
 * (desktop: a folder in the app's data folder). One per app and device, replaced on each install; an unsigned IPA
 * holds no secret.
 */
export type KeptIpaStore = {
  /** Writes `stream` to `key` (replacing what was there only once it's complete) and returns it as a file. */
  put(key: string, stream: ReadableStream<Uint8Array>): Promise<FileSource>
  get(key: string): Promise<FileSource | undefined>
  /** Removing a missing entry is not an error. */
  delete(key: string): Promise<void>
}
