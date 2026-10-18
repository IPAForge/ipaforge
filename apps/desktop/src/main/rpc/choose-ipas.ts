// The file dialog behind "Choose files…" on the Preload page. It runs here, in the main process: the window is
// sandboxed and never sees the file system, it only gets the paths the user picked.
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'

import type { ChooseIpasDeps } from '@desktop/main/rpc/types.ts'
import type { ChooseIpas } from '@ipaforge/rpc'

const IPA_FILTER = { name: 'iOS apps', extensions: ['ipa'] }

export const createIpaChooser =
  ({ showOpenDialog }: ChooseIpasDeps): ChooseIpas =>
  async () => {
    const { canceled, filePaths } = await showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [IPA_FILTER]
    })
    if (canceled) return []
    return Promise.all(
      filePaths.map(async (path) => ({
        path,
        name: basename(path),
        size: (await stat(path)).size
      }))
    )
  }
