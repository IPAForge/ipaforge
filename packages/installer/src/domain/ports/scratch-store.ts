import type { FileSource } from "@loadstar/kernel";

/**
 * Where signed IPAs wait between signing and installing (desktop: a temporary folder). The device needs a file
 * with a known size, and IPAs are too large to keep in memory.
 */
export interface ScratchStore {
  /** Writes `stream` to `key` and returns it as a file. */
  put(key: string, stream: ReadableStream<Uint8Array>): Promise<FileSource>;
  /** Removing a missing entry is not an error. */
  delete(key: string): Promise<void>;
}
