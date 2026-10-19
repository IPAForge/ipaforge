import type { KeptIpaStore } from '@installer/domain/ports/kept-ipa-store.ts'
import { bytesFileSource, concatBytes, type FileSource } from '@ipaforge/kernel'

const readAll = async (
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()

  for (;;) {
    const { done, value } = await reader.read()

    if (done) break
    chunks.push(value)
  }

  return concatBytes(chunks)
}

/** Keeps IPAs in memory: for tests, and for hosts that don't keep them (Refresh then can't sign them again). */
export const createMemoryKeptIpaStore = (): KeptIpaStore => {
  const files = new Map<string, FileSource>()

  return {
    put: async (key, stream) => {
      const file = bytesFileSource(key, await readAll(stream))

      files.set(key, file)

      return file
    },
    get: async (key) => files.get(key),
    delete: async (key) => {
      files.delete(key)
    }
  }
}
