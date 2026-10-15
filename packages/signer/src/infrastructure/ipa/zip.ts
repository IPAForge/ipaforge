// zip.js plumbing shared by reading and writing: one-time setup, the FileSource reader, error mapping.

import { configure, Reader } from '@zip.js/zip.js'

import {
  compact,
  ErrorCode,
  type FileSource,
  LoadstarError
} from '@loadstar/kernel'

let configured = false
export const ensureConfigured = (): void => {
  if (configured) return
  // Native (De)CompressionStream in Node ≥ 22; no zip.js worker scripts needed.
  configure({ useWebWorkers: false, useCompressionStream: true })
  configured = true
}

/** zip.js Reader over the kernel FileSource port (file on disk or download). */
export class FileSourceReader extends Reader<FileSource> {
  readonly #source: FileSource

  constructor(source: FileSource) {
    super(source)
    this.#source = source
  }

  override async init(): Promise<void> {
    await super.init?.()
    this.size = this.#source.size
  }

  /** zip.js may request past the end; the result must then be truncated to the remaining bytes. */
  override readUint8Array(index: number, length: number): Promise<Uint8Array> {
    return this.#source.slice(
      index,
      Math.min(index + length, this.#source.size)
    )
  }
}

const zipSlip = (name: string): LoadstarError =>
  new LoadstarError(ErrorCode.ZipSlip, {
    message: 'archive entry escapes its directory',
    data: { entry: name }
  })

/** Rejects paths that could escape an extraction directory, on any OS. */
export const assertSafePath = (name: string): void => {
  if (
    name.includes('\\') ||
    name.startsWith('/') ||
    /^[A-Za-z]:/.test(name) ||
    name.includes('\0')
  ) {
    throw zipSlip(name)
  }
  if (name.split('/').some((part) => part === '..')) throw zipSlip(name)
}

export const invalidArchive = (
  message: string,
  data?: Record<string, unknown>
): LoadstarError =>
  new LoadstarError(ErrorCode.InvalidBundle, compact({ message, data }))

/** zip.js throws plain Errors; map them onto our codes (it also refuses unsafe names itself). */
export const zipError = (error: unknown, entry?: string): LoadstarError => {
  if (error instanceof LoadstarError) return error
  const message = error instanceof Error ? error.message : String(error)
  if (/unsafe filename/i.test(message)) {
    return new LoadstarError(ErrorCode.ZipSlip, {
      message: 'archive entry escapes its directory',
      cause: error
    })
  }
  return new LoadstarError(ErrorCode.InvalidBundle, {
    ...compact({
      message: `unreadable archive: ${message}`,
      data: entry ? { entry } : undefined
    }),
    cause: error
  })
}
