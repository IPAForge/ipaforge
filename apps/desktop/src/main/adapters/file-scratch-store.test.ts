import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createFileScratchStore } from '@desktop/main/adapters/file-scratch-store.ts'
import { bytesFileSource } from '@ipaforge/kernel'

const PERMISSION_BITS = 0o777
const dirs: string[] = []

const tempRoot = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'ipaforge-scratch-'))
  dirs.push(dir)
  return join(dir, 'scratch')
}

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  )
})

describe('createFileScratchStore', () => {
  it.skipIf(process.platform === 'win32')(
    'writes files only the user can read, in a private folder',
    async () => {
      const root = await tempRoot()
      const store = createFileScratchStore(root)
      await store.put(
        'signed/app.ipa',
        bytesFileSource('app.ipa', new Uint8Array([1, 2, 3])).stream()
      )
      expect(
        (await stat(join(root, 'signed/app.ipa'))).mode & PERMISSION_BITS
      ).toBe(0o600)
      expect((await stat(join(root, 'signed'))).mode & PERMISSION_BITS).toBe(
        0o700
      )
    }
  )

  it('removes what an earlier run left behind before its first write', async () => {
    const root = await tempRoot()
    await mkdir(join(root, 'signed'), { recursive: true })
    await writeFile(join(root, 'signed/stale.ipa'), 'stale')
    const store = createFileScratchStore(root)
    await store.put(
      'signed/new.ipa',
      bytesFileSource('new.ipa', new Uint8Array([1])).stream()
    )
    expect(await store.has('signed/stale.ipa')).toBe(false)
    expect(await store.has('signed/new.ipa')).toBe(true)
    await store.delete('signed/new.ipa')
    expect(await store.has('signed/new.ipa')).toBe(false)
  })
})
