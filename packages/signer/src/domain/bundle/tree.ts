import { DEFAULT_FILE_MODE } from '@signer/domain/bundle/layout.ts'
import type { BundleTree } from '@signer/domain/bundle/types.ts'

export const joinPath = (...parts: readonly string[]): string =>
  parts.filter((part) => part.length > 0).join('/')

export const parentOf = (path: string): string =>
  path.slice(0, Math.max(0, path.lastIndexOf('/')))

export const baseName = (path: string): string =>
  path.slice(path.lastIndexOf('/') + 1)

/** True when `path` is `dir` itself or inside it (`dir` = "" is the bundle root). */
export const isWithin = (path: string, dir: string): boolean =>
  dir === '' || path === dir || path.startsWith(`${dir}/`)

/** Path relative to `dir`. */
export const relativeTo = (path: string, dir: string): string =>
  dir === '' ? path : path.slice(dir.length + 1)

export const readFile = (
  tree: BundleTree,
  path: string
): Uint8Array | undefined => {
  const entry = tree.get(path)

  return entry?.kind === 'file' ? entry.data : undefined
}

export const writeFile = (
  tree: BundleTree,
  path: string,
  data: Uint8Array,
  mode?: number
): void => {
  const existing = tree.get(path)
  tree.set(path, {
    kind: 'file',
    data,
    mode: mode ?? existing?.mode ?? DEFAULT_FILE_MODE
  })
}

/** Removes `path` and everything beneath it. */
export const removePath = (tree: BundleTree, path: string): number => {
  let removed = 0
  for (const key of [...tree.keys()]) {
    if (key === path || key.startsWith(`${path}/`)) {
      tree.delete(key)
      removed++
    }
  }
  return removed
}
