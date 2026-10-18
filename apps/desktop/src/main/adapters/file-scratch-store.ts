// ScratchStore on disk: signed IPAs wait here between signing and installing. A signed IPA can hold SideStore's
// certificate and private key, so the folder is private to the user (0700, files 0600) and is emptied before its
// first use, removing anything a crashed run left behind.
import { createWriteStream } from 'node:fs'
import { access, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Writable } from 'node:stream'

import { nodeFileSource } from '@desktop/main/adapters/file-source.ts'
import type { ScratchStore } from '@ipaforge/installer'

const PRIVATE_DIR_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600

/** Keys become nested paths; anything outside a safe character set is replaced. */
const safePath = (key: string): string =>
  key
    .split('/')
    .map((part) => part.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '_'))
    .filter((part) => part.length > 0)
    .join('/')

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false
  )

const writePrivate = async (
  path: string,
  stream: ReadableStream<Uint8Array>
): Promise<void> => {
  const file = createWriteStream(path, { mode: PRIVATE_FILE_MODE })
  try {
    await stream.pipeTo(Writable.toWeb(file) as WritableStream<Uint8Array>)
  } catch (error) {
    await rm(path, { force: true })
    throw error
  }
}

export const createFileScratchStore = (root: string): ScratchStore => {
  const pathOf = (key: string) => join(root, safePath(key))
  let swept: Promise<void> | undefined
  /** Empties the folder once per process, before anything is written. */
  const sweepLeftovers = () => {
    swept ??= rm(root, { recursive: true, force: true })
    return swept
  }

  return {
    put: async (key, stream) => {
      await sweepLeftovers()
      const path = pathOf(key)
      await mkdir(dirname(path), { recursive: true, mode: PRIVATE_DIR_MODE })
      await writePrivate(path, stream)
      return nodeFileSource(path)
    },
    has: (key) => exists(pathOf(key)),
    delete: async (key) => {
      await rm(pathOf(key), { force: true })
    }
  }
}
