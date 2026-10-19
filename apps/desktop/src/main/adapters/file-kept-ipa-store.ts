// KeptIpaStore on disk: each installed app's original IPA, kept so Refresh can sign it again. Unlike the scratch
// store it's never emptied at start. A new copy is written next to the old one and renamed over it once complete,
// so an interrupted write never loses the IPA that was there.
import { access, mkdir, open, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { nodeFileSource } from '@desktop/main/adapters/file-source.ts'
import type { KeptIpaStore } from '@ipaforge/installer'

const PRIVATE_DIR_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600
const PARTIAL = '.part'

/** Keys become nested paths; anything outside a safe character set is replaced. */
const safePath = (key: string): string =>
  key
    .split('/')
    .map((part) => part.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '_'))
    .filter((part) => part.length > 0)
    .join('/')

/** Writes the stream to `path` chunk by chunk; the file is closed when this returns, whatever happened. */
const writeTo = async (
  path: string,
  stream: ReadableStream<Uint8Array>
): Promise<void> => {
  const file = await open(path, 'w', PRIVATE_FILE_MODE)
  const reader = stream.getReader()

  try {
    for (;;) {
      const { done, value } = await reader.read()

      if (done) return
      await file.write(value)
    }
  } finally {
    reader.releaseLock()
    await file.close()
  }
}

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false
  )

export const createFileKeptIpaStore = (root: string): KeptIpaStore => {
  const pathOf = (key: string) => join(root, safePath(key))

  return {
    put: async (key, stream) => {
      const path = pathOf(key)
      const partial = `${path}${PARTIAL}`

      await mkdir(dirname(path), { recursive: true, mode: PRIVATE_DIR_MODE })

      try {
        await writeTo(partial, stream)
        await rename(partial, path)
      } catch (error) {
        await rm(partial, { force: true })
        throw error
      }

      return nodeFileSource(path)
    },
    get: async (key) => {
      const path = pathOf(key)

      return (await exists(path)) ? nodeFileSource(path) : undefined
    },
    delete: async (key) => {
      await rm(pathOf(key), { force: true })
    }
  }
}
