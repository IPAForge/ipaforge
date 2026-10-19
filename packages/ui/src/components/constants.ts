/** Flips an icon horizontally (in right-to-left languages). */
export const MIRROR_CLASS = '-scale-x-100'

/** For each page that starts a run, what the other running kind is called and where it is. */
export const runElsewhere = {
  sidestore: { titleKey: 'preload.elsewhere.apps', path: '/preload' },
  apps: { titleKey: 'preload.elsewhere.sidestore', path: '/install' }
} as const

/**
 * Icon colours for apps whose source gives none (the IPAForge catalog, an .ipa): picked by name, so an app keeps its
 * colour everywhere. Deep enough for a white letter.
 */
export const ICON_TINTS = [
  '#7a3cf0',
  '#0b6e8a',
  '#c2185b',
  '#3949ab',
  '#2e7d32',
  '#b45309',
  '#0369a1',
  '#6d4c41'
] as const

/** Above this relative luminance a tint takes a dark letter, below it a white one. */
export const LIGHT_TINT_LUMINANCE = 0.4
