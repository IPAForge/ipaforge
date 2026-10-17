// Test-only: an AFC server over an in-memory file system.

import {
  type AfcPacket,
  encodeAfcPacket,
  payloadOf,
  readAfcPacket
} from '@device/infrastructure/afc/codec.ts'
import { AfcOperation } from '@device/infrastructure/afc/constants.ts'
import type { Link } from '@device/infrastructure/framing/link.ts'
import {
  ByteWriter,
  concatBytes,
  trimChar,
  utf8Decode,
  utf8Encode
} from '@loadstar/kernel'

export type FakeFs = {
  readonly files: Map<string, Uint8Array>
  readonly dirs: Set<string>
}

export const createFakeFs = (): FakeFs => ({
  files: new Map(),
  dirs: new Set([''])
})

const normalize = (path: string): string => trimChar(path, '/')
const parent = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''

const cstrings = (values: readonly string[]): Uint8Array => {
  const writer = new ByteWriter()
  for (const value of values) writer.cstring(value)
  return writer.toBytes()
}

const u64 = (value: number | bigint): Uint8Array =>
  new ByteWriter(8).u64le(BigInt(value)).toBytes()

const readCString = (bytes: Uint8Array, from = 0): string => {
  const end = bytes.indexOf(0, from)

  return utf8Decode(bytes.subarray(from, end < 0 ? bytes.byteLength : end))
}

const STATUS = { ok: 0, notFound: 8, exists: 16, notSupported: 15 } as const
const READ_ONLY_MODE = 1n
const MAX_PACKET_BYTES = 1 << 30

type Handle = {
  readonly path: string
  readonly chunks: Uint8Array[]
  position: number
  readonly write: boolean
}

/** One connection's state, shared by the operation handlers. */
type Session = {
  readonly fs: FakeFs
  readonly handles: Map<bigint, Handle>
  nextHandle: bigint
  readonly data: (payload: Uint8Array) => Promise<void>
  readonly reply: (operation: number, header: Uint8Array) => Promise<void>
  readonly status: (code: number) => Promise<void>
}

/** A request: its operation, its arguments and a view over them. */
type Request = {
  readonly packet: AfcPacket
  readonly args: Uint8Array
  readonly view: DataView
}

type Handler = (session: Session, request: Request) => Promise<void>

const childrenOf = (fs: FakeFs, dir: string): Set<string> => {
  const children = new Set<string>()
  for (const path of [...fs.files.keys(), ...fs.dirs]) {
    if (path !== dir && parent(path) === dir)
      children.add(path.slice(dir ? dir.length + 1 : 0))
  }
  return children
}

const readDir: Handler = async (session, { args }) => {
  const dir = normalize(readCString(args))
  if (!session.fs.dirs.has(dir)) return session.status(STATUS.notFound)
  await session.data(cstrings(['.', '..', ...childrenOf(session.fs, dir)]))
}

const fileInfo = (fs: FakeFs, path: string): string[] | undefined => {
  const file = fs.files.get(path)
  if (file) return ['st_size', String(file.byteLength), 'st_ifmt', 'S_IFREG']
  if (fs.dirs.has(path)) return ['st_size', '0', 'st_ifmt', 'S_IFDIR']
  return undefined
}

const getFileInfo: Handler = async (session, { args }) => {
  const info = fileInfo(session.fs, normalize(readCString(args)))
  if (!info) return session.status(STATUS.notFound)
  await session.data(cstrings(info))
}

const addDirs = (fs: FakeFs, path: string): void => {
  for (let dir = path; dir; dir = parent(dir)) fs.dirs.add(dir)
}

const makeDir: Handler = async (session, { args }) => {
  addDirs(session.fs, normalize(readCString(args)))
  await session.status(STATUS.ok)
}

const removeContents = (fs: FakeFs, path: string): void => {
  const prefix = `${path}/`
  for (const key of [...fs.files.keys()])
    if (key.startsWith(prefix)) fs.files.delete(key)
  for (const key of [...fs.dirs])
    if (key.startsWith(prefix)) fs.dirs.delete(key)
}

const removePath: Handler = async (session, { packet, args }) => {
  const { fs } = session
  const path = normalize(readCString(args))
  const existed = fs.files.delete(path) || fs.dirs.delete(path)
  if (packet.operation === AfcOperation.RemovePathAndContents)
    removeContents(fs, path)
  await session.status(existed ? STATUS.ok : STATUS.notFound)
}

const renamePath: Handler = async (session, { args }) => {
  const { fs } = session
  const from = normalize(readCString(args))
  const to = normalize(readCString(args, args.indexOf(0) + 1))
  const file = fs.files.get(from)
  if (!file) return session.status(STATUS.notFound)
  fs.files.delete(from)
  fs.files.set(to, file)
  await session.status(STATUS.ok)
}

/** Reading needs the file; writing needs its directory. */
const canOpen = (fs: FakeFs, path: string, write: boolean): boolean =>
  write ? fs.dirs.has(parent(path)) : fs.files.has(path)

const fileOpen: Handler = async (session, { args, view }) => {
  const write = view.getBigUint64(0, true) !== READ_ONLY_MODE
  const path = normalize(readCString(args, 8))
  if (!canOpen(session.fs, path, write)) return session.status(STATUS.notFound)
  const handle = session.nextHandle++
  session.handles.set(handle, { path, chunks: [], position: 0, write })
  await session.reply(AfcOperation.FileOpenResult, u64(handle))
}

const fileWrite: Handler = async (session, { packet, view }) => {
  const handle = session.handles.get(view.getBigUint64(0, true))
  handle?.chunks.push(packet.data.slice())
  await session.status(handle ? STATUS.ok : STATUS.notFound)
}

const readChunk = (fs: FakeFs, handle: Handle, length: number): Uint8Array => {
  const file = fs.files.get(handle.path) ?? new Uint8Array()
  const chunk = file.subarray(handle.position, handle.position + length)
  handle.position += chunk.byteLength
  return chunk
}

const fileRead: Handler = async (session, { view }) => {
  const handle = session.handles.get(view.getBigUint64(0, true))
  const length = Number(view.getBigUint64(8, true))
  await session.data(
    handle ? readChunk(session.fs, handle, length) : new Uint8Array()
  )
}

const fileClose: Handler = async (session, { view }) => {
  const id = view.getBigUint64(0, true)
  const handle = session.handles.get(id)
  if (handle?.write)
    session.fs.files.set(handle.path, concatBytes(handle.chunks))
  session.handles.delete(id)
  await session.status(STATUS.ok)
}

const getDeviceInfo: Handler = (session) =>
  session.data(cstrings(['Model', 'iPhone99,1', 'FSTotalBytes', '64000000000']))

const HANDLERS: Readonly<Record<number, Handler>> = {
  [AfcOperation.ReadDir]: readDir,
  [AfcOperation.GetFileInfo]: getFileInfo,
  [AfcOperation.MakeDir]: makeDir,
  [AfcOperation.RemovePath]: removePath,
  [AfcOperation.RemovePathAndContents]: removePath,
  [AfcOperation.RenamePath]: renamePath,
  [AfcOperation.FileOpen]: fileOpen,
  [AfcOperation.FileWrite]: fileWrite,
  [AfcOperation.FileRead]: fileRead,
  [AfcOperation.FileClose]: fileClose,
  [AfcOperation.GetDeviceInfo]: getDeviceInfo
}

const createSession = (link: Link, fs: FakeFs): Session => {
  const reply = (operation: number, header: Uint8Array, data?: Uint8Array) =>
    link.write(
      encodeAfcPacket({
        operation,
        packetNumber: 0n,
        header,
        data: data ?? new Uint8Array()
      })
    )

  return {
    fs,
    handles: new Map(),
    nextHandle: 1n,
    data: (payload) => reply(AfcOperation.Data, new Uint8Array(), payload),
    reply,
    status: (code) => reply(AfcOperation.Status, u64(code))
  }
}

const toRequest = (packet: AfcPacket): Request => {
  const args = payloadOf(packet)

  return {
    packet,
    args,
    view: new DataView(args.buffer, args.byteOffset, args.byteLength)
  }
}

/** The next packet, or `undefined` once the client has closed the link. */
const nextPacket = async (link: Link): Promise<AfcPacket | undefined> => {
  try {
    return await readAfcPacket(link, MAX_PACKET_BYTES)
  } catch {
    return undefined
  }
}

/** Serves AFC on `link` until the client closes it. Returns when the connection ends. */
export const serveAfc = async (link: Link, fs: FakeFs): Promise<void> => {
  const session = createSession(link, fs)
  for (
    let packet = await nextPacket(link);
    packet;
    packet = await nextPacket(link)
  ) {
    const handler = HANDLERS[packet.operation]
    if (handler) await handler(session, toRequest(packet))
    else await session.status(STATUS.notSupported)
  }
}

export const fileText = (fs: FakeFs, path: string): string | undefined => {
  const bytes = fs.files.get(path)

  return bytes ? utf8Decode(bytes) : undefined
}

export const putFile = (
  fs: FakeFs,
  path: string,
  content: string | Uint8Array
): void => {
  addDirs(fs, parent(path))
  fs.files.set(
    path,
    typeof content === 'string' ? utf8Encode(content) : content
  )
}
