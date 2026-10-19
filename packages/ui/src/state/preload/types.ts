import type { AppSource } from '@ui/services/engine/types.ts'

/** Why an app was turned away before the Engine was asked: not an .ipa, or a dropped file with no path. */
export type PreloadRefusal = 'not-ipa' | 'unreadable'

/** An app in the preload list: where it is, and what to call it until the Engine has read it. */
export type PreloadItem = {
  readonly id: string
  /** Undefined for a file that was turned away. */
  readonly source?: AppSource | undefined
  /** The file name, the link, or the catalog app's name. */
  readonly label: string
  /** For an app picked in Browse apps: its bundle id (a catalog app's id), so its card says it's added. */
  readonly appId?: string | undefined
  /** For an app from an app source: the source's name, shown as where it comes from. */
  readonly origin?: string | undefined
  readonly size?: number | undefined
  readonly refused?: PreloadRefusal | undefined
}

export type NewPreloadItem = Omit<PreloadItem, 'id'>

/** The apps the Preload page will install, kept while the user visits other sections. */
export type PreloadStore = {
  getState: () => readonly PreloadItem[]
  subscribe: (listener: () => void) => () => void
  /** Adds apps; one already in the list (same file, link or catalog app) isn't added twice. */
  add: (items: readonly NewPreloadItem[]) => void
  remove: (id: string) => void
  clear: () => void
}
