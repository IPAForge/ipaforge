import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createFileSignedIpaFolder } from '@desktop/main/adapters/file-signed-ipa-folder.ts'
import { utf8Encode } from '@ipaforge/kernel'

const dirs: string[] = []

afterEach(async () => {
  for (const dir of dirs.splice(0))
    await rm(dir, { recursive: true, force: true })
})

const folder = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ipaforge-signed-'))

  dirs.push(dir)

  return dir
}

const streamOf = (text: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(utf8Encode(text))
      controller.close()
    }
  })

const failing = () =>
  new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new Error('signing stopped'))
    }
  })

describe('saving signed IPAs to a folder', () => {
  it('writes the app under its name, and never replaces one already there', async () => {
    const dir = await folder()
    const output = createFileSignedIpaFolder()

    const first = await output.save(dir, 'App 1.0.ipa', streamOf('one'))
    const second = await output.save(dir, 'App 1.0.ipa', streamOf('two'))

    expect(first).toBe(join(dir, 'App 1.0.ipa'))
    expect(second).toBe(join(dir, 'App 1.0 (2).ipa'))
    expect(await readFile(first, 'utf8')).toBe('one')
    expect(await readFile(second, 'utf8')).toBe('two')
  })

  it('keeps a name with folders in it inside the folder', async () => {
    const dir = await folder()

    const path = await createFileSignedIpaFolder().save(
      dir,
      '../../escape.ipa',
      streamOf('x')
    )

    expect(path).toBe(join(dir, 'escape.ipa'))
  })

  it('leaves nothing behind when the signed app fails to arrive', async () => {
    const dir = await folder()

    await expect(
      createFileSignedIpaFolder().save(dir, 'App.ipa', failing())
    ).rejects.toThrow('signing stopped')
    expect(await readdir(dir)).toEqual([])
  })
})
