import type { FileSource } from "@loadstar/kernel";

/**
 * Where downloaded IPAs are kept (desktop: the app's cache folder). Entries are written in full and verified
 * before they become visible, so a half-finished download is never returned.
 */
export interface DownloadStore {
  /** A completed entry, or `undefined`. */
  get(key: string): Promise<FileSource | undefined>;
  /** Writes `stream` to `key`; `verify` runs after the last byte and before the entry is kept (throw to discard). */
  put(key: string, stream: ReadableStream<Uint8Array>, verify: () => Promise<void>): Promise<FileSource>;
  delete(key: string): Promise<void>;
}
