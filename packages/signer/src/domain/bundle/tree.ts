/**
 * In-memory view of an app bundle: files and symlinks keyed by '/'-separated paths relative to
 * the `.app` root. Directories are implicit. Unix modes are kept (executable bits matter on iOS).
 */
export type TreeEntry =
  | { readonly kind: "file"; readonly data: Uint8Array; readonly mode: number }
  | { readonly kind: "symlink"; readonly target: string; readonly mode: number };

export type BundleTree = Map<string, TreeEntry>;

export const DEFAULT_FILE_MODE = 0o644;
export const EXECUTABLE_MODE = 0o755;
export const SYMLINK_MODE = 0o755;

export const joinPath = (...parts: readonly string[]): string => parts.filter((part) => part.length > 0).join("/");

export const parentOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf("/")));

export const baseName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

/** True when `path` is `dir` itself or inside it (`dir` = "" is the bundle root). */
export const isWithin = (path: string, dir: string): boolean =>
  dir === "" || path === dir || path.startsWith(`${dir}/`);

/** Path relative to `dir`. */
export const relativeTo = (path: string, dir: string): string => (dir === "" ? path : path.slice(dir.length + 1));

export const readFile = (tree: BundleTree, path: string): Uint8Array | undefined => {
  const entry = tree.get(path);
  return entry?.kind === "file" ? entry.data : undefined;
};

export const writeFile = (tree: BundleTree, path: string, data: Uint8Array, mode?: number): void => {
  const existing = tree.get(path);
  tree.set(path, { kind: "file", data, mode: mode ?? existing?.mode ?? DEFAULT_FILE_MODE });
};

/** Removes `path` and everything beneath it. */
export const removePath = (tree: BundleTree, path: string): number => {
  let removed = 0;
  for (const key of [...tree.keys()]) {
    if (key === path || key.startsWith(`${path}/`)) {
      tree.delete(key);
      removed++;
    }
  }
  return removed;
};
