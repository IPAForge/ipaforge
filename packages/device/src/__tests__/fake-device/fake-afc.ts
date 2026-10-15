// Test-only: an AFC server over an in-memory file system.

import { encodeAfcPacket, payloadOf, readAfcPacket } from "@device/infrastructure/afc/codec.ts";
import { AfcOperation } from "@device/infrastructure/afc/constants.ts";
import type { Link } from "@device/infrastructure/framing/link.ts";
import { ByteWriter, utf8Decode, utf8Encode } from "@loadstar/kernel";

export interface FakeFs {
  readonly files: Map<string, Uint8Array>;
  readonly dirs: Set<string>;
}

export const createFakeFs = (): FakeFs => ({ files: new Map(), dirs: new Set([""]) });

const normalize = (path: string): string => path.replace(/^\/+|\/+$/g, "");
const parent = (path: string): string => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");

const cstrings = (values: readonly string[]): Uint8Array => {
  const writer = new ByteWriter();
  for (const value of values) writer.cstring(value);
  return writer.toBytes();
};

const u64 = (value: number | bigint): Uint8Array => new ByteWriter(8).u64le(BigInt(value)).toBytes();

const readCString = (bytes: Uint8Array, from = 0): string => {
  const end = bytes.indexOf(0, from);
  return utf8Decode(bytes.subarray(from, end < 0 ? bytes.byteLength : end));
};

const STATUS = { ok: 0, notFound: 8, exists: 16 } as const;

/** Serves AFC on `link` until the client closes it. Returns when the connection ends. */
export const serveAfc = async (link: Link, fs: FakeFs): Promise<void> => {
  const handles = new Map<bigint, { path: string; chunks: Uint8Array[]; position: number; write: boolean }>();
  let nextHandle = 1n;

  const reply = (operation: number, header: Uint8Array = new Uint8Array(), data: Uint8Array = new Uint8Array()) =>
    link.write(encodeAfcPacket({ operation, packetNumber: 0n, header, data }));
  const status = (code: number) => reply(AfcOperation.Status, u64(code));

  for (;;) {
    let packet: Awaited<ReturnType<typeof readAfcPacket>>;
    try {
      packet = await readAfcPacket(link, 1 << 30);
    } catch {
      return;
    }
    const args = payloadOf(packet);
    const view = new DataView(args.buffer, args.byteOffset, args.byteLength);
    switch (packet.operation) {
      case AfcOperation.ReadDir: {
        const dir = normalize(readCString(args));
        if (!fs.dirs.has(dir)) {
          await status(STATUS.notFound);
          break;
        }
        const children = new Set<string>();
        for (const path of [...fs.files.keys(), ...fs.dirs]) {
          if (path !== dir && parent(path) === dir) children.add(path.slice(dir ? dir.length + 1 : 0));
        }
        await reply(AfcOperation.Data, new Uint8Array(), cstrings([".", "..", ...children]));
        break;
      }
      case AfcOperation.GetFileInfo: {
        const path = normalize(readCString(args));
        const file = fs.files.get(path);
        if (file)
          await reply(
            AfcOperation.Data,
            new Uint8Array(),
            cstrings(["st_size", String(file.byteLength), "st_ifmt", "S_IFREG"]),
          );
        else if (fs.dirs.has(path))
          await reply(AfcOperation.Data, new Uint8Array(), cstrings(["st_size", "0", "st_ifmt", "S_IFDIR"]));
        else await status(STATUS.notFound);
        break;
      }
      case AfcOperation.MakeDir: {
        let path = normalize(readCString(args));
        while (path) {
          fs.dirs.add(path);
          path = parent(path);
        }
        await status(STATUS.ok);
        break;
      }
      case AfcOperation.RemovePath:
      case AfcOperation.RemovePathAndContents: {
        const path = normalize(readCString(args));
        const existed = fs.files.delete(path) || fs.dirs.delete(path);
        if (packet.operation === AfcOperation.RemovePathAndContents) {
          for (const key of [...fs.files.keys()]) if (key.startsWith(`${path}/`)) fs.files.delete(key);
          for (const key of [...fs.dirs]) if (key.startsWith(`${path}/`)) fs.dirs.delete(key);
        }
        await status(existed ? STATUS.ok : STATUS.notFound);
        break;
      }
      case AfcOperation.RenamePath: {
        const from = normalize(readCString(args));
        const to = normalize(readCString(args, args.indexOf(0) + 1));
        const file = fs.files.get(from);
        if (!file) {
          await status(STATUS.notFound);
          break;
        }
        fs.files.delete(from);
        fs.files.set(to, file);
        await status(STATUS.ok);
        break;
      }
      case AfcOperation.FileOpen: {
        const mode = view.getBigUint64(0, true);
        const path = normalize(readCString(args, 8));
        const write = mode !== 1n;
        if (!write && !fs.files.has(path)) {
          await status(STATUS.notFound);
          break;
        }
        if (write && !fs.dirs.has(parent(path))) {
          await status(STATUS.notFound);
          break;
        }
        const handle = nextHandle++;
        handles.set(handle, { path, chunks: [], position: 0, write });
        await reply(AfcOperation.FileOpenResult, u64(handle));
        break;
      }
      case AfcOperation.FileWrite: {
        const handle = handles.get(view.getBigUint64(0, true));
        handle?.chunks.push(packet.data.slice());
        await status(handle ? STATUS.ok : STATUS.notFound);
        break;
      }
      case AfcOperation.FileRead: {
        const handle = handles.get(view.getBigUint64(0, true));
        const length = Number(view.getBigUint64(8, true));
        const file = handle ? (fs.files.get(handle.path) ?? new Uint8Array()) : new Uint8Array();
        const chunk = handle ? file.subarray(handle.position, handle.position + length) : new Uint8Array();
        if (handle) handle.position += chunk.byteLength;
        await reply(AfcOperation.Data, new Uint8Array(), chunk);
        break;
      }
      case AfcOperation.FileClose: {
        const id = view.getBigUint64(0, true);
        const handle = handles.get(id);
        if (handle?.write) {
          const total = handle.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
          const out = new Uint8Array(total);
          let offset = 0;
          for (const chunk of handle.chunks) {
            out.set(chunk, offset);
            offset += chunk.byteLength;
          }
          fs.files.set(handle.path, out);
        }
        handles.delete(id);
        await status(STATUS.ok);
        break;
      }
      case AfcOperation.GetDeviceInfo:
        await reply(
          AfcOperation.Data,
          new Uint8Array(),
          cstrings(["Model", "iPhone99,1", "FSTotalBytes", "64000000000"]),
        );
        break;
      default:
        await status(15);
    }
  }
};

export const fileText = (fs: FakeFs, path: string): string | undefined => {
  const bytes = fs.files.get(path);
  return bytes ? utf8Decode(bytes) : undefined;
};

export const putFile = (fs: FakeFs, path: string, content: string | Uint8Array): void => {
  let dir = parent(path);
  while (dir) {
    fs.dirs.add(dir);
    dir = parent(dir);
  }
  fs.files.set(path, typeof content === "string" ? utf8Encode(content) : content);
};
