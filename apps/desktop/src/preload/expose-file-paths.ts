// The only API the preload gives the page: the path of a file the user dropped on the window, for "drop .ipa files
// here". It reveals nothing the drop didn't hand the page already, and opens or reads nothing.
import type { FilePathBridge } from '@desktop/preload/types.ts'
import {
  FILE_PATHS_GLOBAL,
  type FilePaths
} from '@desktop/shared/file-paths.ts'

export const exposeFilePaths = ({
  contextBridge,
  webUtils
}: FilePathBridge) => {
  const paths: FilePaths = {
    pathOf: (file) => webUtils.getPathForFile(file as never)
  }
  contextBridge.exposeInMainWorld(FILE_PATHS_GLOBAL, paths)
}
