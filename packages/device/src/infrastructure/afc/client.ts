import { forEachChunk } from "@device/infrastructure/afc/chunks.ts";
import {
  cstring,
  encodeAfcPacket,
  keyValues,
  payloadOf,
  readAfcPacket,
  readU64,
  splitCStrings,
  u64,
} from "@device/infrastructure/afc/codec.ts";
import { AFC_STATUS_SUCCESS, AFC_U64_SIZE, AfcFileMode, AfcOperation } from "@device/infrastructure/afc/constants.ts";
import { afcStatusError, isObjectNotFound } from "@device/infrastructure/afc/errors.ts";
import type { Link } from "@device/infrastructure/framing/link.ts";
import { ByteWriter, compact, concatBytes, ErrorCode, LoadstarError, type Logger } from "@loadstar/kernel";

export type AfcFileType = "file" | "directory" | "symlink" | "other";

export interface AfcStat {
  readonly type: AfcFileType;
  readonly size: number;
  /** Every key the device reported (st_size, st_ifmt, st_mtime, …). */
  readonly raw: Readonly<Record<string, string>>;
}

export interface AfcWriteOptions {
  /** Total bytes, for progress (optional). */
  readonly totalBytes?: number;
  readonly onProgress?: (written: number, total: number | undefined) => void;
  readonly signal?: AbortSignal;
}

export interface AfcClient {
  readDir(path: string): Promise<string[]>;
  stat(path: string): Promise<AfcStat>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  remove(path: string, options?: { recursive?: boolean }): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: Uint8Array | ReadableStream<Uint8Array>, options?: AfcWriteOptions): Promise<void>;
  deviceInfo(): Promise<Readonly<Record<string, string>>>;
  close(): Promise<void>;
}

export interface AfcClientOptions {
  readonly logger: Logger;
  readonly maxMessageBytes: number;
  readonly writeChunkBytes: number;
  readonly readChunkBytes: number;
}

interface AfcRequest {
  /** Operation name for logs and errors. */
  readonly name: string;
  readonly operation: number;
  readonly header: Uint8Array;
  readonly data?: Uint8Array;
  /** The path the request is about, for logs and errors. */
  readonly path?: string;
}

/** `st_ifmt` values → file types. */
const FILE_TYPES: ReadonlyMap<string, AfcFileType> = new Map([
  ["S_IFREG", "file"],
  ["S_IFDIR", "directory"],
  ["S_IFLNK", "symlink"],
]);

const fileType = (ifmt: string | undefined): AfcFileType => FILE_TYPES.get(ifmt ?? "") ?? "other";

const SPECIAL_ENTRIES = new Set(["", ".", ".."]);

/** A request whose only argument is `path`. */
const pathRequest = (name: string, operation: number, path: string): AfcRequest => ({
  name,
  operation,
  header: cstring(path),
  path,
});

/** An AFC client over `link` (the AFC service, or a house_arrest container after vending). */
export const createAfcClient = (link: Link, options: AfcClientOptions): AfcClient => {
  const { logger } = options;
  let packetNumber = 0n;
  let queue: Promise<unknown> = Promise.resolve();

  /** One request at a time: AFC has no request tags. */
  const exclusive = <T>(run: () => Promise<T>): Promise<T> => {
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  };

  /** Sends a request; throws on a non-zero STATUS; returns the response payload otherwise. */
  const call = async ({ name, operation, header, data = new Uint8Array(), path }: AfcRequest) => {
    logger.debug("afc", compact({ op: name, path: path || undefined }));
    await link.write(encodeAfcPacket({ operation, packetNumber: packetNumber++, header, data }));
    const response = await readAfcPacket(link, options.maxMessageBytes);
    const payload = payloadOf(response);
    if (response.operation === AfcOperation.Status) {
      const status = Number(readU64(payload) ?? 0n);
      if (status !== AFC_STATUS_SUCCESS) throw afcStatusError(status, name, path);
    }
    return { operation: response.operation, payload };
  };

  const open = async (path: string, mode: bigint): Promise<bigint> => {
    const header = new ByteWriter().u64le(mode).cstring(path).toBytes();
    const { operation, payload } = await call({ name: "FileOpen", operation: AfcOperation.FileOpen, header, path });
    const handle = operation === AfcOperation.FileOpenResult ? readU64(payload) : undefined;
    if (handle === undefined) {
      throw new LoadstarError(ErrorCode.AfcError, { message: "FileOpen returned no handle", data: { path } });
    }
    return handle;
  };

  const closeHandle = (handle: bigint) =>
    call({ name: "FileClose", operation: AfcOperation.FileClose, header: u64(handle) });

  const stat = async (path: string): Promise<AfcStat> => {
    const { payload } = await call(pathRequest("GetFileInfo", AfcOperation.GetFileInfo, path));
    const raw = keyValues(splitCStrings(payload));
    return { type: fileType(raw.st_ifmt), size: Number(raw.st_size ?? 0), raw };
  };

  const exists = async (path: string): Promise<boolean> => {
    try {
      await stat(path);
      return true;
    } catch (error) {
      if (isObjectNotFound(error)) return false;
      throw error;
    }
  };

  const readDir = async (path: string): Promise<string[]> => {
    const { payload } = await call(pathRequest("ReadDir", AfcOperation.ReadDir, path));
    return splitCStrings(payload).filter((name) => !SPECIAL_ENTRIES.has(name));
  };

  /** Reads `handle` to the end, one `readChunkBytes` request at a time. */
  const readChunks = async (handle: bigint, path: string): Promise<Uint8Array[]> => {
    const chunks: Uint8Array[] = [];
    for (;;) {
      const header = new ByteWriter(2 * AFC_U64_SIZE).u64le(handle).u64le(BigInt(options.readChunkBytes)).toBytes();
      const { payload } = await call({ name: "FileRead", operation: AfcOperation.FileRead, header, path });
      if (payload.byteLength === 0) return chunks;
      chunks.push(payload);
      if (payload.byteLength < options.readChunkBytes) return chunks;
    }
  };

  const readFile = async (path: string): Promise<Uint8Array> => {
    const handle = await open(path, AfcFileMode.ReadOnly);
    try {
      return concatBytes(await readChunks(handle, path));
    } finally {
      await closeHandle(handle);
    }
  };

  const writeFile = async (
    path: string,
    content: Uint8Array | ReadableStream<Uint8Array>,
    writeOptions: AfcWriteOptions,
  ): Promise<void> => {
    const started = Date.now();
    const total = content instanceof Uint8Array ? content.byteLength : writeOptions.totalBytes;
    const handle = await open(path, AfcFileMode.WriteOnly);
    let written = 0;
    try {
      await forEachChunk(content, options.writeChunkBytes, async (chunk) => {
        writeOptions.signal?.throwIfAborted();
        await call({ name: "FileWrite", operation: AfcOperation.FileWrite, header: u64(handle), data: chunk, path });
        written += chunk.byteLength;
        writeOptions.onProgress?.(written, total);
      });
    } finally {
      await closeHandle(handle);
    }
    logger.info("afc upload done", { path, bytes: written, ms: Date.now() - started });
  };

  const deviceInfo = async (): Promise<Record<string, string>> => {
    const { payload } = await call({
      name: "GetDeviceInfo",
      operation: AfcOperation.GetDeviceInfo,
      header: new Uint8Array(),
    });
    return keyValues(splitCStrings(payload));
  };

  return {
    readDir: (path) => exclusive(() => readDir(path)),
    stat: (path) => exclusive(() => stat(path)),
    exists: (path) => exclusive(() => exists(path)),
    mkdir: (path) =>
      exclusive(async () => {
        await call(pathRequest("MakeDir", AfcOperation.MakeDir, path));
      }),
    remove: (path, removeOptions = {}) =>
      exclusive(async () => {
        const operation = removeOptions.recursive ? AfcOperation.RemovePathAndContents : AfcOperation.RemovePath;
        await call(pathRequest("Remove", operation, path));
      }),
    rename: (from, to) =>
      exclusive(async () => {
        const header = new ByteWriter().cstring(from).cstring(to).toBytes();
        await call({ name: "RenamePath", operation: AfcOperation.RenamePath, header, path: from });
      }),
    readFile: (path) => exclusive(() => readFile(path)),
    writeFile: (path, content, writeOptions = {}) => exclusive(() => writeFile(path, content, writeOptions)),
    deviceInfo: () => exclusive(deviceInfo),
    close: () => link.close(),
  };
};
