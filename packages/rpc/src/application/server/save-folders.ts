// The folders the user picked in the host's dialog for Save signed .ipa instead, by id. The page names a folder only
// by its id, so a run can write only where the user chose.
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'
import type { ChooseSaveFolder } from '@rpc/domain/ports/choose-save-folder.ts'
import type { ChosenFolder } from '@rpc/domain/types.ts'

/** The last part of a path, `/` or `\` separated: what the page shows of the folder. */
const folderName = (path: string): string =>
  path.split(/[\\/]/).filter(Boolean).at(-1) ?? path

export type SaveFolders = {
  /** Opens the host's dialog; nothing when the user cancels or the host has none. */
  choose(): Promise<ChosenFolder | null>
  /** The path of a folder picked in this connection; `rpc.invalid_message` for any other id. */
  pathOf(id: string): string
}

export const createSaveFolders = (
  chooseSaveFolder: ChooseSaveFolder | undefined
): SaveFolders => {
  const folders = new Map<string, string>()

  return {
    choose: async () => {
      const path = await chooseSaveFolder?.()
      if (!path) return null
      const id = globalThis.crypto.randomUUID()
      folders.set(id, path)

      return { id, name: folderName(path) }
    },
    pathOf: (id) => {
      const path = folders.get(id)
      if (path === undefined)
        throw new IPAForgeError(ErrorCode.InvalidRpcMessage, {
          message: 'unknown save folder'
        })

      return path
    }
  }
}
