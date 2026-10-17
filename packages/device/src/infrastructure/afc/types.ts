import type { Logger } from '@loadstar/kernel'

export type AfcFileType = 'file' | 'directory' | 'symlink' | 'other'

export type AfcStat = {
  readonly type: AfcFileType
  readonly size: number
  /** Every key the device reported (st_size, st_ifmt, st_mtime, …). */
  readonly raw: Readonly<Record<string, string>>
}

export type AfcWriteOptions = {
  /** Total bytes, for progress (optional). */
  readonly totalBytes?: number
  readonly onProgress?: (written: number, total: number | undefined) => void
  readonly signal?: AbortSignal
}

export type AfcClient = {
  readDir(path: string): Promise<string[]>
  stat(path: string): Promise<AfcStat>
  exists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  remove(path: string, options?: { recursive?: boolean }): Promise<void>
  rename(from: string, to: string): Promise<void>
  readFile(path: string): Promise<Uint8Array>
  writeFile(
    path: string,
    content: Uint8Array | ReadableStream<Uint8Array>,
    options?: AfcWriteOptions
  ): Promise<void>
  deviceInfo(): Promise<Readonly<Record<string, string>>>
  close(): Promise<void>
}

export type AfcClientOptions = {
  readonly logger: Logger
  readonly maxMessageBytes: number
  readonly writeChunkBytes: number
  readonly readChunkBytes: number
}

export type AfcRequest = {
  /** Operation name for logs and errors. */
  readonly name: string
  readonly operation: number
  readonly header: Uint8Array
  readonly data?: Uint8Array
  /** The path the request is about, for logs and errors. */
  readonly path?: string
}
