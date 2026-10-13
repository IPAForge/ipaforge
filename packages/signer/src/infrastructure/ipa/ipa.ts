import { ErrorCode, type FileSource, LoadstarError, type Logger, utf8Decode, utf8Encode } from "@loadstar/kernel";
import { type BundleTree, EXECUTABLE_MODE, SYMLINK_MODE, type TreeEntry } from "@signer/domain/bundle/tree.ts";
import { configure, Reader, Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from "@zip.js/zip.js";

/** Limits that keep a hostile archive from exhausting memory. */
export interface IpaLimits {
  readonly maxEntries: number;
  readonly maxUncompressedBytes: number;
}

export const DEFAULT_IPA_LIMITS: IpaLimits = { maxEntries: 200_000, maxUncompressedBytes: 4 * 1024 ** 3 };

export interface Ipa {
  /** e.g. `SideStore.app` */
  readonly appName: string;
  /** The `.app` contents, paths relative to the `.app` directory. */
  readonly app: BundleTree;
  /** Other top-level content kept for re-packing (e.g. `SwiftSupport/`), paths relative to the archive root. */
  readonly extras: BundleTree;
}

const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;
/** Archive members never carried over (Apple account metadata, macOS resource forks). */
const DROPPED = [/^__MACOSX\//, /^iTunesMetadata\.plist$/, /^META-INF\/com\.apple\.ZipMetadata\.plist$/];

let configured = false;
const ensureConfigured = (): void => {
  if (configured) return;
  // Native (De)CompressionStream in Node ≥ 22 and browsers; no zip.js worker scripts needed.
  configure({ useWebWorkers: false, useCompressionStream: true });
  configured = true;
};

/** zip.js Reader over the kernel FileSource port (desktop file, browser File, download). */
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
export const readIpa = async (
  source: FileSource,
  options: { readonly logger: Logger; readonly signal?: AbortSignal; readonly limits?: IpaLimits },
): Promise<Ipa> => {
  ensureConfigured();
  const limits = options.limits ?? DEFAULT_IPA_LIMITS;
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
      const match = /^Payload\/([^/]+\.app)(?:\/|$)/.exec(entry.filename);
      if (match?.[1]) appNames.add(match[1]);
    }
    if (appNames.size !== 1) {
      throw invalid(appNames.size === 0 ? "no Payload/*.app in archive" : "more than one app in Payload/", {
        apps: [...appNames],
      });
    }
    const appName = [...appNames][0] as string;
    const appPrefix = `Payload/${appName}/`;

    const app: BundleTree = new Map();
    const extras: BundleTree = new Map();
    let total = 0;
    let ignored = 0;
    for (const entry of entries) {
      options.signal?.throwIfAborted();
      if (entry.directory || DROPPED.some((pattern) => pattern.test(entry.filename))) {
        if (!entry.directory) ignored++;
        continue;
      }
      if (entry.encrypted) throw invalid("encrypted archive entries are not supported", { entry: entry.filename });
      total += entry.uncompressedSize;
      if (total > limits.maxUncompressedBytes) throw invalid("archive expands beyond the size limit", { total });

      const data = await entry.getData(new Uint8ArrayWriter()).catch((error: unknown) => {
        throw zipError(error, entry.filename);
      });
      const unixMode = entry.unixMode ?? (entry.executable ? EXECUTABLE_MODE : 0o644);
      const isSymlink = entry.symlink || (unixMode & S_IFMT) === S_IFLNK;
      const value: TreeEntry = isSymlink
        ? { kind: "symlink", target: utf8Decode(data), mode: SYMLINK_MODE }
        : { kind: "file", data, mode: unixMode & 0o7777 };

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

/** Already-compressed formats are stored, not deflated again. */
const STORED = /\.(?:png|jpe?g|gif|heic|car|mp3|m4a|mp4|mov|zip|ipa|gz|lzfse)$/i;

/** Writes an .ipa as a stream; directories, unix modes and symlinks are preserved. */
export const writeIpa = (
  ipa: Ipa,
  options: { readonly logger: Logger; readonly level?: number },
): ReadableStream<Uint8Array> => {
  ensureConfigured();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const started = Date.now();

  const files = new Map<string, TreeEntry>();
  for (const [path, entry] of ipa.app) files.set(`Payload/${ipa.appName}/${path}`, entry);
  for (const [path, entry] of ipa.extras) files.set(path, entry);

  const write = async (): Promise<void> => {
    const writer = new ZipWriter(writable, { useWebWorkers: false, extendedTimestamp: false });
    const lastModDate = new Date("2026-01-01T00:00:00Z"); // deterministic archives
    for (const dir of parentDirectories(files.keys())) {
      await writer.add(dir, undefined, { directory: true, unixMode: 0o40755, lastModDate });
    }
    let bytes = 0;
    for (const path of [...files.keys()].sort()) {
      const entry = files.get(path) as TreeEntry;
      if (entry.kind === "symlink") {
        await writer.add(path, new Uint8ArrayReader(utf8Encode(entry.target)), {
          unixMode: S_IFLNK | 0o777,
          level: 0,
          lastModDate,
        });
        continue;
      }
      bytes += entry.data.byteLength;
      await writer.add(path, new Uint8ArrayReader(entry.data), {
        unixMode: 0o100000 | (entry.mode & 0o7777),
        level: STORED.test(path) ? 0 : (options.level ?? 6),
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
