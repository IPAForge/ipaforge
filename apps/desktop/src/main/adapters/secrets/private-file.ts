import { chmod, mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Replaces `path` with a file only the user can read (0600, in a 0700 directory). The data goes to a temporary
 * file first and is renamed into place, so a crash never leaves a half-written store.
 */
export const writePrivateFile = async (
  path: string,
  data: string | Uint8Array
): Promise<void> => {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.tmp`
  await writeFile(temporary, data, { mode: 0o600 })
  await chmod(temporary, 0o600)
  await rename(temporary, path)
}
