import { ErrorCode, type FileSource, LoadstarError, type Logger, utf8Decode, utf8Encode } from "@loadstar/kernel";
import {
  DEFAULT_FILE_MODE,
  DIRECTORY_MODE,
  EXECUTABLE_MODE,
  IPA_PAYLOAD_DIR,
  PERMISSION_BITS,
  S_IFDIR,
  S_IFLNK,
  S_IFMT,
  S_IFREG,
  SYMLINK_MODE,
} from "@signer/domain/bundle/layout.ts";
import type { BundleTree, TreeEntry } from "@signer/domain/bundle/tree.ts";
import { type ArchiveLimits, DEFAULT_SIGNER_LIMITS } from "@signer/domain/config.ts";
import { configure, Reader, Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from "@zip.js/zip.js";

export interface Ipa {
  /** e.g. `SideStore.app` */
  readonly appName: string;
  /** The `.app` contents, paths relative to the `.app` directory. */
  readonly app: BundleTree;
  /** Other top-level content kept for re-packing (e.g. `SwiftSupport/`), paths relative to the archive root. */
  readonly extras: BundleTree;
}

/** Archive members dropped by default when reading: Apple-account metadata and macOS resource forks. */
export const DEFAULT_DROPPED_MEMBERS: readonly RegExp[] = [
  /^__MACOSX\//,
  /^iTunesMetadata\.plist$/,
  /^META-INF\/com\.apple\.ZipMetadata\.plist$/,
];

/** Already-compressed formats stored without deflating again by default when writing. */
export const DEFAULT_STORED_EXTENSIONS: RegExp = /\.(?:png|jpe?g|gif|heic|car|mp3|m4a|mp4|mov|zip|ipa|gz|lzfse)$/i;

/** Timestamp written on every archive entry so output is deterministic (overridable). */
export const DEFAULT_ENTRY_DATE = new Date("2026-01-01T00:00:00Z");

export interface ReadIpaOptions {
  readonly logger: Logger;
  readonly signal?: AbortSignal;
  readonly limits?: ArchiveLimits;
  /** Members to skip (default: DEFAULT_DROPPED_MEMBERS). */
  readonly droppedMembers?: readonly RegExp[];
}

export interface WriteIpaOptions {
  readonly logger: Logger;
  /** Deflate level 0–9 (0 = store everything; fastest, fine for device installs). Default 6. */
  readonly level?: number;
  /** Paths matching this are always stored (default: DEFAULT_STORED_EXTENSIONS). */
  readonly storedExtensions?: RegExp;
  /** Modification time recorded for every entry (default: DEFAULT_ENTRY_DATE). */
  readonly entryDate?: Date;
}

let configured = false;
const ensureConfigured = (): void => {
  if (configured) return;
  // Native (De)CompressionStream in Node ≥ 22; no zip.js worker scripts needed.
  configure({ useWebWorkers: false, useCompressionStream: true });
  configured = true;
};

/** zip.js Reader over the kernel FileSource port (file on disk or download). */
class FileSourceReader extends Reader<FileSource> {
  readonly #source: FileSource;

  constructor(source: FileSource) {
    super(source);
    this.#source = source;
  }

  override async init(): Promise<void> {
    await super.init?.();
    this.size = this.#source.size;
  }

  /** zip.js may request past the end; the result must then be truncated to the remaining bytes. */
  override readUint8Array(index: number, length: number): Promise<Uint8Array> {
    return this.#source.slice(index, Math.min(index + length, this.#source.size));
  }
}

const zipSlip = (name: string): LoadstarError =>
  new LoadstarError(ErrorCode.ZipSlip, { message: "archive entry escapes its directory", data: { entry: name } });

/** Rejects paths that could escape an extraction directory, on any OS. */
export const assertSafePath = (name: string): void => {
  if (name.includes("\\") || name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.includes("\0")) {
    throw zipSlip(name);
  }
  if (name.split("/").some((part) => part === "..")) throw zipSlip(name);
};

const invalid = (message: string, data?: Record<string, unknown>): LoadstarError =>
  new LoadstarError(ErrorCode.InvalidBundle, { message, ...(data ? { data } : {}) });

/** zip.js throws plain Errors; map them onto our codes (it also refuses unsafe names itself). */
const zipError = (error: unknown, entry?: string): LoadstarError => {
  if (error instanceof LoadstarError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/unsafe filename/i.test(message)) {
    return new LoadstarError(ErrorCode.ZipSlip, { message: "archive entry escapes its directory", cause: error });
  }
  return new LoadstarError(ErrorCode.InvalidBundle, {
    message: `unreadable archive: ${message}`,
    cause: error,
    ...(entry ? { data: { entry } } : {}),
  });
};

/** Reads an .ipa: exactly one `Payload/<name>.app`, modes and symlinks preserved. */
export const readIpa = async (source: FileSource, options: ReadIpaOptions): Promise<Ipa> => {
  ensureConfigured();
  const limits = options.limits ?? DEFAULT_SIGNER_LIMITS.ipa;
  const dropped = options.droppedMembers ?? DEFAULT_DROPPED_MEMBERS;
  const started = Date.now();
  const reader = new ZipReader(new FileSourceReader(source));
  try {
    const entries = await reader.getEntries().catch((error: unknown) => {
      throw zipError(error);
    });
    if (entries.length > limits.maxEntries) throw invalid("archive has too many entries", { entries: entries.length });

    const appNames = new Set<string>();
    for (const entry of entries) {
      assertSafePath(entry.filename);
      const match = new RegExp(`^${IPA_PAYLOAD_DIR}/([^/]+\\.app)(?:/|$)`).exec(entry.filename);
      if (match?.[1]) appNames.add(match[1]);
    }
    if (appNames.size !== 1) {
      throw invalid(appNames.size === 0 ? "no Payload/*.app in archive" : "more than one app in Payload/", {
        apps: [...appNames],
      });
    }
    const appName = [...appNames][0] as string;
    const appPrefix = `${IPA_PAYLOAD_DIR}/${appName}/`;

    const app: BundleTree = new Map();
    const extras: BundleTree = new Map();
    let total = 0;
    let ignored = 0;
    for (const entry of entries) {
      options.signal?.throwIfAborted();
      if (entry.directory || dropped.some((pattern) => pattern.test(entry.filename))) {
        if (!entry.directory) ignored++;
        continue;
      }
      if (entry.encrypted) throw invalid("encrypted archive entries are not supported", { entry: entry.filename });
      total += entry.uncompressedSize;
      if (total > limits.maxUncompressedBytes) throw invalid("archive expands beyond the size limit", { total });

      const data = await entry.getData(new Uint8ArrayWriter()).catch((error: unknown) => {
        throw zipError(error, entry.filename);
      });
      const unixMode = entry.unixMode ?? (entry.executable ? EXECUTABLE_MODE : DEFAULT_FILE_MODE);
      const isSymlink = entry.symlink || (unixMode & S_IFMT) === S_IFLNK;
      const value: TreeEntry = isSymlink
        ? { kind: "symlink", target: utf8Decode(data), mode: SYMLINK_MODE }
        : { kind: "file", data, mode: unixMode & PERMISSION_BITS };

      if (entry.filename.startsWith(appPrefix)) app.set(entry.filename.slice(appPrefix.length), value);
      else extras.set(entry.filename, value);
    }

    options.logger.debug("ipa read", {
      appName,
      appEntries: app.size,
      extras: extras.size,
      ignored,
      bytes: total,
      ms: Date.now() - started,
    });
    return { appName, app, extras };
  } finally {
    await reader.close();
  }
};

const parentDirectories = (paths: Iterable<string>): string[] => {
  const dirs = new Set<string>();
  for (const path of paths) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(`${parts.slice(0, i).join("/")}/`);
  }
  return [...dirs].sort();
};

/** Writes an .ipa as a stream; directories, unix modes and symlinks are preserved. */
export const writeIpa = (ipa: Ipa, options: WriteIpaOptions): ReadableStream<Uint8Array> => {
  ensureConfigured();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const started = Date.now();

  const files = new Map<string, TreeEntry>();
  for (const [path, entry] of ipa.app) files.set(`${IPA_PAYLOAD_DIR}/${ipa.appName}/${path}`, entry);
  for (const [path, entry] of ipa.extras) files.set(path, entry);

  const write = async (): Promise<void> => {
    const writer = new ZipWriter(writable, { useWebWorkers: false, extendedTimestamp: false });
    const lastModDate = options.entryDate ?? DEFAULT_ENTRY_DATE;
    const stored = options.storedExtensions ?? DEFAULT_STORED_EXTENSIONS;
    for (const dir of parentDirectories(files.keys())) {
      await writer.add(dir, undefined, { directory: true, unixMode: S_IFDIR | DIRECTORY_MODE, lastModDate });
    }
    let bytes = 0;
    for (const path of [...files.keys()].sort()) {
      const entry = files.get(path) as TreeEntry;
      if (entry.kind === "symlink") {
        await writer.add(path, new Uint8ArrayReader(utf8Encode(entry.target)), {
          unixMode: S_IFLNK | 0o777, // symlink permissions are conventionally rwxrwxrwx
          level: 0,
          lastModDate,
        });
        continue;
      }
      bytes += entry.data.byteLength;
      await writer.add(path, new Uint8ArrayReader(entry.data), {
        unixMode: S_IFREG | (entry.mode & PERMISSION_BITS),
        level: stored.test(path) ? 0 : (options.level ?? 6),
        lastModDate,
      });
    }
    await writer.close();
    options.logger.debug("ipa written", { entries: files.size, bytes, ms: Date.now() - started });
  };

  write().catch(async (error: unknown) => {
    options.logger.error("ipa write failed", { error });
    await writable.abort(error).catch(() => {});
  });
  return readable;
};
