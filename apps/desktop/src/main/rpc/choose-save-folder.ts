// The folder dialog behind Save signed .ipa instead on the Preload page. It runs here, in the main process: the
// window is sandboxed and never sees the file system; the RPC server keeps the path and gives the page an id for it.
import type { ChooseSaveFolderDeps } from '@desktop/main/rpc/types.ts'
import type { ChooseSaveFolder } from '@ipaforge/rpc'

export const createSaveFolderChooser =
  ({ showOpenDialog }: ChooseSaveFolderDeps): ChooseSaveFolder =>
  async () => {
    const { canceled, filePaths } = await showOpenDialog({
      // The system's own button text: it's in the user's language, which this process doesn't know.
      properties: ['openDirectory', 'createDirectory']
    })

    return canceled ? undefined : filePaths[0]
  }
