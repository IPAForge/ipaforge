// Node FileSource: a file on disk, streamed (IPAs can be large) with random-access reads.
import { createReadStream } from 'node:fs'
import { open, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { Readable } from 'node:stream'

import type { FileSource } from '@ipaforge/kernel'

export const nodeFileSource = async (path: string): Promise<FileSource> => {
  const { size } = await stat(path)

  return {
    name: basename(path),
    size,
    stream: () =>
      Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>,
    slice: async (start, end) => {
      const handle = await open(path, 'r')
      try {
        const length = Math.max(0, Math.min(end, size) - start)
        const buffer = new Uint8Array(length)
        await handle.read(buffer, 0, length, start)
        return buffer
      } finally {
        await handle.close()
      }
    }
  }
}
