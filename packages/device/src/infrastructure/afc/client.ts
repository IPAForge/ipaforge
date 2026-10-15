import { encodeAfcPacket, payloadOf, readAfcPacket, splitCStrings } from "@device/infrastructure/afc/codec.ts";
import {
  AFC_STATUS_NAMES,
  AFC_STATUS_OBJECT_NOT_FOUND,
  AfcFileMode,
  AfcOperation,
} from "@device/infrastructure/afc/constants.ts";
import type { Link } from "@device/infrastructure/framing/link.ts";
import { ByteWriter, ErrorCode, LoadstarError, type Logger } from "@loadstar/kernel";

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

const cstring = (text: string): Uint8Array => new ByteWriter().cstring(text).toBytes();

const pairs = (strings: readonly string[]): Record<string, string> => {
  const out: Record<string, string> = Object.create(null);
  for (let i = 0; i + 1 < strings.length; i += 2) out[strings[i] as string] = strings[i + 1] as string;
  return out;
};

const fileType = (ifmt: string | undefined): AfcFileType =>
  ifmt === "S_IFREG" ? "file" : ifmt === "S_IFDIR" ? "directory" : ifmt === "S_IFLNK" ? "symlink" : "other";

export const afcStatusError = (status: number, operation: string, path?: string): LoadstarError =>
  new LoadstarError(ErrorCode.AfcError, {
    message: `AFC ${operation} failed: ${AFC_STATUS_NAMES[status] ?? status}`,
    data: { afcStatus: AFC_STATUS_NAMES[status] ?? String(status), operation, ...(path ? { path } : {}) },
  });

const u64 = (value: bigint): Uint8Array => new ByteWriter(8).u64le(value).toBytes();

/** Calls `onChunk` for each piece of `content`, at most `chunkBytes` long, in order. */
const forEachChunk = async (
  content: Uint8Array | ReadableStream<Uint8Array>,
  chunkBytes: number,
  onChunk: (chunk: Uint8Array) => Promise<void>,
): Promise<void> => {
  const split = async (bytes: Uint8Array) => {
    for (let i = 0; i < bytes.byteLength; i += chunkBytes) await onChunk(bytes.subarray(i, i + chunkBytes));
  };
  if (content instanceof Uint8Array) {
    await split(content);
    return;
  }
  const reader = content.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      await split(value);
    }
  } finally {
    reader.releaseLock();
  }
};

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

  const roundTrip = async (operation: number, header: Uint8Array, data: Uint8Array = new Uint8Array()) => {
    await link.write(encodeAfcPacket({ operation, packetNumber: packetNumber++, header, data }));
    return readAfcPacket(link, options.maxMessageBytes);
  };

  /** Sends a request; throws on a non-zero STATUS; returns the response payload otherwise. */
  const call = async (name: string, operation: number, header: Uint8Array, data?: Uint8Array, path?: string) => {
    logger.debug("afc", { op: name, ...(path ? { path } : {}) });
    const response = await roundTrip(operation, header, data);
    const payload = payloadOf(response);
    if (response.operation === AfcOperation.Status) {
      const status =
        payload.byteLength >= 8 ? Number(new DataView(payload.buffer, payload.byteOffset).getBigUint64(0, true)) : 0;
      if (status !== 0) throw afcStatusError(status, name, path);
    }
    return { operation: response.operation, payload };
  };

  const open = async (path: string, mode: bigint): Promise<bigint> => {
    const { operation, payload } = await call(
      "FileOpen",
      AfcOperation.FileOpen,
      new ByteWriter().u64le(mode).cstring(path).toBytes(),
      undefined,
      path,
    );
    if (operation !== AfcOperation.FileOpenResult || payload.byteLength < 8) {
      throw new LoadstarError(ErrorCode.AfcError, { message: "FileOpen returned no handle", data: { path } });
    }
    return new DataView(payload.buffer, payload.byteOffset).getBigUint64(0, true);
  };

  const closeHandle = (handle: bigint) => call("FileClose", AfcOperation.FileClose, u64(handle));

  const stat = async (path: string): Promise<AfcStat> => {
    const { payload } = await call("GetFileInfo", AfcOperation.GetFileInfo, cstring(path), undefined, path);
    const raw = pairs(splitCStrings(payload));
    return { type: fileType(raw.st_ifmt), size: Number(raw.st_size ?? 0), raw };
  };

  return {
    readDir: (path) =>
      exclusive(async () => {
        const { payload } = await call("ReadDir", AfcOperation.ReadDir, cstring(path), undefined, path);
        return splitCStrings(payload).filter((name) => name !== "" && name !== "." && name !== "..");
      }),

    stat: (path) => exclusive(() => stat(path)),

    exists: (path) =>
      exclusive(async () => {
        try {
          await stat(path);
          return true;
        } catch (error) {
          if (
            error instanceof LoadstarError &&
            error.data?.afcStatus === AFC_STATUS_NAMES[AFC_STATUS_OBJECT_NOT_FOUND]
          ) {
            return false;
          }
          throw error;
        }
      }),

    mkdir: (path) =>
      exclusive(async () => {
        await call("MakeDir", AfcOperation.MakeDir, cstring(path), undefined, path);
      }),

    remove: (path, removeOptions = {}) =>
      exclusive(async () => {
        const operation = removeOptions.recursive ? AfcOperation.RemovePathAndContents : AfcOperation.RemovePath;
        await call("Remove", operation, cstring(path), undefined, path);
      }),

    rename: (from, to) =>
      exclusive(async () => {
        await call(
          "RenamePath",
          AfcOperation.RenamePath,
          new ByteWriter().cstring(from).cstring(to).toBytes(),
          undefined,
          from,
        );
      }),

    readFile: (path) =>
      exclusive(async () => {
        const handle = await open(path, AfcFileMode.ReadOnly);
        const chunks: Uint8Array[] = [];
        try {
          for (;;) {
            const request = new ByteWriter(16).u64le(handle).u64le(BigInt(options.readChunkBytes)).toBytes();
            const { payload } = await call("FileRead", AfcOperation.FileRead, request, undefined, path);
            if (payload.byteLength === 0) break;
            chunks.push(payload);
            if (payload.byteLength < options.readChunkBytes) break;
          }
        } finally {
          await closeHandle(handle);
        }
        const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const out = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          out.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return out;
      }),

    writeFile: (path, content, writeOptions = {}) =>
      exclusive(async () => {
        const started = Date.now();
        const total = content instanceof Uint8Array ? content.byteLength : writeOptions.totalBytes;
        const handle = await open(path, AfcFileMode.WriteOnly);
        let written = 0;
        try {
          await forEachChunk(content, options.writeChunkBytes, async (chunk) => {
            writeOptions.signal?.throwIfAborted();
            await call("FileWrite", AfcOperation.FileWrite, u64(handle), chunk, path);
            written += chunk.byteLength;
            writeOptions.onProgress?.(written, total);
          });
        } finally {
          await closeHandle(handle);
        }
        logger.info("afc upload done", { path, bytes: written, ms: Date.now() - started });
      }),

    deviceInfo: () =>
      exclusive(async () => {
        const { payload } = await call("GetDeviceInfo", AfcOperation.GetDeviceInfo, new Uint8Array());
        return pairs(splitCStrings(payload));
      }),

    close: () => link.close(),
  };
};
