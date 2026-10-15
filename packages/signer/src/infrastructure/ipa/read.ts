import type { FileSource, Logger } from "@loadstar/kernel";
import { utf8Decode } from "@loadstar/kernel";
import {
  DEFAULT_FILE_MODE,
  EXECUTABLE_MODE,
  IPA_PAYLOAD_DIR,
  PERMISSION_BITS,
  S_IFLNK,
  S_IFMT,
  SYMLINK_MODE,
} from "@signer/domain/bundle/layout.ts";
import type { BundleTree, TreeEntry } from "@signer/domain/bundle/tree.ts";
import { type ArchiveLimits, DEFAULT_SIGNER_LIMITS } from "@signer/domain/config.ts";
import { DEFAULT_DROPPED_MEMBERS, type Ipa } from "@signer/infrastructure/ipa/ipa.ts";
import {
  assertSafePath,
  ensureConfigured,
  FileSourceReader,
  invalidArchive,
  zipError,
} from "@signer/infrastructure/ipa/zip.ts";
import { type Entry, type FileEntry, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js";

export interface ReadIpaOptions {
  readonly logger: Logger;
  readonly signal?: AbortSignal;
  readonly limits?: ArchiveLimits;
  /** Members to skip (default: DEFAULT_DROPPED_MEMBERS). */
  readonly droppedMembers?: readonly RegExp[];
}

/** Checks every name for path escapes and returns the single `Payload/<name>.app`. */
const findAppName = (entries: readonly Entry[]): string => {
  const appPattern = new RegExp(`^${IPA_PAYLOAD_DIR}/([^/]+\\.app)(?:/|$)`);
  const appNames = new Set<string>();
  for (const entry of entries) {
    assertSafePath(entry.filename);
    const match = appPattern.exec(entry.filename);
    if (match?.[1]) appNames.add(match[1]);
  }
  if (appNames.size !== 1) {
    throw invalidArchive(appNames.size === 0 ? "no Payload/*.app in archive" : "more than one app in Payload/", {
      apps: [...appNames],
    });
  }
  return [...appNames][0] as string;
};

/** A file or symlink, keeping Unix permission bits (executables matter on iOS). */
const toTreeEntry = (entry: FileEntry, data: Uint8Array): TreeEntry => {
  const unixMode = entry.unixMode ?? (entry.executable ? EXECUTABLE_MODE : DEFAULT_FILE_MODE);
  const isSymlink = entry.symlink || (unixMode & S_IFMT) === S_IFLNK;
  return isSymlink
    ? { kind: "symlink", target: utf8Decode(data), mode: SYMLINK_MODE }
    : { kind: "file", data, mode: unixMode & PERMISSION_BITS };
};

const readEntryData = (entry: FileEntry): Promise<Uint8Array> =>
  entry.getData(new Uint8ArrayWriter()).catch((error: unknown) => {
    throw zipError(error, entry.filename);
  });

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
    if (entries.length > limits.maxEntries) {
      throw invalidArchive("archive has too many entries", { entries: entries.length });
    }
    const appName = findAppName(entries);
    const appPrefix = `${IPA_PAYLOAD_DIR}/${appName}/`;

    const app: BundleTree = new Map();
    const extras: BundleTree = new Map();
    let total = 0;
    let ignored = 0;
    for (const entry of entries) {
      options.signal?.throwIfAborted();
      if (entry.directory) continue;
      if (dropped.some((pattern) => pattern.test(entry.filename))) {
        ignored++;
        continue;
      }
      if (entry.encrypted) {
        throw invalidArchive("encrypted archive entries are not supported", { entry: entry.filename });
      }
      total += entry.uncompressedSize;
      if (total > limits.maxUncompressedBytes) throw invalidArchive("archive expands beyond the size limit", { total });

      const value = toTreeEntry(entry, await readEntryData(entry));
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
