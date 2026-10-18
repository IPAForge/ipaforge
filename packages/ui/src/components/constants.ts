/** Flips an icon horizontally (in right-to-left languages). */
export const MIRROR_CLASS = '-scale-x-100'

/** For each page that starts a run, what the other running kind is called and where it is. */
export const runElsewhere = {
  sidestore: { titleKey: 'preload.elsewhere.apps', path: '/preload' },
  apps: { titleKey: 'preload.elsewhere.sidestore', path: '/install' }
} as const
