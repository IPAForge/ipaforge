// DownloadStore on disk: each entry is written to a temporary file and renamed into place only after it has been
// verified, so the cache never contains a partial or tampered download.
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Writable } from 'node:stream'

import { nodeFileSource } from '@desktop/main/adapters/file-source.ts'
import type { DownloadStore } from '@loadstar/catalog'

/** Cache keys become nested paths; anything outside a safe character set is replaced. */
const safePath = (key: string): string =>
  key
    .split('/')
    .map((part) => part.replace(/[^A-Za-z0-9._+-]/g, '_').replace(/^\.+/, '_'))
    .filter((part) => part.length > 0)
    .join('/')

export const createFileDownloadStore = (root: string): DownloadStore => {
  const pathOf = (key: string) => join(root, safePath(key))

  return {
    get: async (key) => {
      const path = pathOf(key)
      try {
        if (!(await stat(path)).isFile()) return undefined
      } catch {
        return undefined
      }
      return nodeFileSource(path)
    },
    put: async (key, stream, verify) => {
      const path = pathOf(key)
      const temporary = `${path}.partial-${process.pid}-${Date.now()}`
      await mkdir(dirname(path), { recursive: true })
      try {
        await stream.pipeTo(
          Writable.toWeb(
            createWriteStream(temporary)
          ) as WritableStream<Uint8Array>
        )
        await verify()
        await rename(temporary, path)
      } catch (error) {
        await rm(temporary, { force: true })
        throw error
      }
      return nodeFileSource(path)
    },
    delete: async (key) => {
      await rm(pathOf(key), { force: true })
    }
  }
}
