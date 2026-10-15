import { Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js'

import { type Logger, utf8Encode } from '@loadstar/kernel'
import {
  DIRECTORY_MODE,
  IPA_PAYLOAD_DIR,
  PERMISSION_BITS,
  S_IFDIR,
  S_IFLNK,
  S_IFREG,
  SYMLINK_ARCHIVE_PERMISSIONS
} from '@signer/domain/bundle/layout.ts'
import type { TreeEntry } from '@signer/domain/bundle/tree.ts'
import {
  DEFAULT_DEFLATE_LEVEL,
  DEFAULT_ENTRY_DATE,
  DEFAULT_STORED_EXTENSIONS,
  type Ipa
} from '@signer/infrastructure/ipa/ipa.ts'
import { ensureConfigured } from '@signer/infrastructure/ipa/zip.ts'

export type WriteIpaOptions = {
  readonly logger: Logger
  /** Deflate level 0–9 (0 = store everything; fastest, fine for device installs). Default 6. */
  readonly level?: number
  /** Paths matching this are always stored (default: DEFAULT_STORED_EXTENSIONS). */
  readonly storedExtensions?: RegExp
  /** Modification time recorded for every entry (default: DEFAULT_ENTRY_DATE). */
  readonly entryDate?: Date
}

const parentDirectories = (paths: Iterable<string>): string[] => {
  const dirs = new Set<string>()
  for (const path of paths) {
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++)
      dirs.add(`${parts.slice(0, i).join('/')}/`)
  }
  return [...dirs].sort()
}

/** Archive paths for every entry: the app under `Payload/<name>.app/`, extras at the root. */
const archiveFiles = (ipa: Ipa): Map<string, TreeEntry> => {
  const files = new Map<string, TreeEntry>()
  for (const [path, entry] of ipa.app)
    files.set(`${IPA_PAYLOAD_DIR}/${ipa.appName}/${path}`, entry)
  for (const [path, entry] of ipa.extras) files.set(path, entry)
  return files
}

/** Adds one file or symlink; returns the file bytes written (0 for symlinks). */
const addEntry = async (
  writer: ZipWriter<unknown>,
  path: string,
  entry: TreeEntry,
  settings: {
    readonly lastModDate: Date
    readonly stored: RegExp
    readonly level: number
  }
): Promise<number> => {
  const { lastModDate } = settings
  if (entry.kind === 'symlink') {
    await writer.add(path, new Uint8ArrayReader(utf8Encode(entry.target)), {
      unixMode: S_IFLNK | SYMLINK_ARCHIVE_PERMISSIONS,
      level: 0,
      lastModDate
    })
    return 0
  }
  await writer.add(path, new Uint8ArrayReader(entry.data), {
    unixMode: S_IFREG | (entry.mode & PERMISSION_BITS),
    level: settings.stored.test(path) ? 0 : settings.level,
    lastModDate
  })
  return entry.data.byteLength
}

/** Writes an .ipa as a stream; directories, unix modes and symlinks are preserved. */
export const writeIpa = (
  ipa: Ipa,
  options: WriteIpaOptions
): ReadableStream<Uint8Array> => {
  ensureConfigured()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const started = Date.now()
  const files = archiveFiles(ipa)

  const write = async (): Promise<void> => {
    const writer = new ZipWriter(writable, {
      useWebWorkers: false,
      extendedTimestamp: false
    })
    const settings = {
      lastModDate: options.entryDate ?? DEFAULT_ENTRY_DATE,
      stored: options.storedExtensions ?? DEFAULT_STORED_EXTENSIONS,
      level: options.level ?? DEFAULT_DEFLATE_LEVEL
    }
    for (const dir of parentDirectories(files.keys())) {
      await writer.add(dir, undefined, {
        directory: true,
        unixMode: S_IFDIR | DIRECTORY_MODE,
        lastModDate: settings.lastModDate
      })
    }
    let bytes = 0
    for (const path of [...files.keys()].sort()) {
      bytes += await addEntry(
        writer,
        path,
        files.get(path) as TreeEntry,
        settings
      )
    }
    await writer.close()
    options.logger.debug('ipa written', {
      entries: files.size,
      bytes,
      ms: Date.now() - started
    })
  }

  write().catch(async (error: unknown) => {
    options.logger.error('ipa write failed', { error })
    await writable.abort(error).catch(() => {})
  })
  return readable
}
