import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createFileKeptIpaStore } from '@desktop/main/adapters/file-kept-ipa-store.ts'
import { utf8Decode, utf8Encode } from '@ipaforge/kernel'

const dirs: string[] = []

afterEach(async () => {
  for (const dir of dirs.splice(0))
    await rm(dir, { recursive: true, force: true })
})

const store = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ipaforge-kept-'))

  dirs.push(dir)

  return { dir, kept: createFileKeptIpaStore(dir) }
}

const streamOf = (text: string) =>
  new ReadableStream<Uint8Array>({
    start: (controller) => {
      controller.enqueue(utf8Encode(text))
      controller.close()
    }
  })

const failing = () =>
  new ReadableStream<Uint8Array>({
    start: (controller) => {
      controller.enqueue(utf8Encode('half'))
      controller.error(new Error('interrupted'))
    }
  })

type Kept = ReturnType<typeof createFileKeptIpaStore>

/** The kept IPA's text; fails when it isn't there. */
const textOf = async (kept: Kept, key: string) => {
  const file = await kept.get(key)

  if (!file) throw new Error(`nothing kept at ${key}`)

  return utf8Decode(
    new Uint8Array(await new Response(file.stream()).arrayBuffer())
  )
}

describe('the kept-IPA store', () => {
  it('keeps an IPA, gives it back, replaces it, and removes it', async () => {
    const { kept } = await store()

    await kept.put('UDID/com.example.app.ipa', streamOf('first'))
    expect(await textOf(kept, 'UDID/com.example.app.ipa')).toBe('first')

    await kept.put('UDID/com.example.app.ipa', streamOf('second'))
    expect(await textOf(kept, 'UDID/com.example.app.ipa')).toBe('second')

    await kept.delete('UDID/com.example.app.ipa')
    expect(await kept.get('UDID/com.example.app.ipa')).toBeUndefined()
  })

  it('keeps the old IPA when writing a new one fails, and leaves no partial file', async () => {
    const { dir, kept } = await store()

    await kept.put('UDID/app.ipa', streamOf('good'))
    await expect(kept.put('UDID/app.ipa', failing())).rejects.toThrow()

    expect(await textOf(kept, 'UDID/app.ipa')).toBe('good')
    expect(await readdir(join(dir, 'UDID'))).toEqual(['app.ipa'])
  })
})
