import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { createIpaChooser } from '@desktop/main/rpc/choose-ipas.ts'

describe('createIpaChooser', () => {
  it('opens the dialog for several .ipa files and answers with their paths, names and sizes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ipaforge-choose-'))
    const path = join(dir, 'Game.ipa')
    await writeFile(path, new Uint8Array(42))
    const showOpenDialog = vi.fn(async () => ({
      canceled: false,
      filePaths: [path]
    }))

    expect(await createIpaChooser({ showOpenDialog })()).toEqual([
      { path, name: 'Game.ipa', size: 42 }
    ])
    expect(showOpenDialog).toHaveBeenCalledWith({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'iOS apps', extensions: ['ipa'] }]
    })
  })

  it('answers with nothing when the user cancels', async () => {
    const showOpenDialog = async () => ({ canceled: true, filePaths: [] })

    expect(await createIpaChooser({ showOpenDialog })()).toEqual([])
  })
})
