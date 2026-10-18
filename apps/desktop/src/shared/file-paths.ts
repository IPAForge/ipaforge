/** Where the preload puts the one function the page gets: the path of a file the user dropped on the window. */
export const FILE_PATHS_GLOBAL = 'ipaforgeFiles'

/** What the page finds under `window[FILE_PATHS_GLOBAL]`. */
export type FilePaths = {
  /** The path of a file the user dropped (a `File` from a drop event); empty for any other file. */
  pathOf(file: unknown): string
}
