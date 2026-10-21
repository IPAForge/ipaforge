// SignedIpaFolder on disk: Save signed .ipa instead writes into the folder the user picked. A file already there is
// never replaced: "App.ipa" becomes "App (2).ipa". It's written under a temporary name and renamed once complete,
// so an interrupted save leaves no half-written app.
import { open, rename, rm } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

import type { SignedIpaFolder } from '@ipaforge/installer'

const PARTIAL = '.part'
const MAX_TRIES = 100

/** The name as given, or with " (2)", " (3)"… before its extension. */
const numbered = (name: string, count: number): string => {
  if (count === 1) return name
  const extension = extname(name)

  return `${basename(name, extension)} (${count})${extension}`
}

/** Creates `path` only if it doesn't exist yet (the name stays taken while it's written). */
const claim = async (path: string): Promise<boolean> => {
  try {
    await (await open(path, 'wx')).close()
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw error
  }
}

const writeTo = async (
  path: string,
  stream: ReadableStream<Uint8Array>
): Promise<void> => {
  const file = await open(path, 'w')
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

export const createFileSignedIpaFolder = (): SignedIpaFolder => ({
  save: async (folder, name, stream) => {
    // Only a plain name is ever joined to the folder: nothing can climb out of it.
    const safe = basename(name)

    for (let count = 1; count <= MAX_TRIES; count++) {
      const path = join(folder, numbered(safe, count))

      if (!(await claim(path))) continue
      const partial = `${path}${PARTIAL}`
      try {
        await writeTo(partial, stream)
        await rename(partial, path)
        return path
      } catch (error) {
        await rm(partial, { force: true })
        await rm(path, { force: true })
        throw error
      }
    }
    throw new Error(`no free name for ${safe} in ${folder}`)
  }
})
