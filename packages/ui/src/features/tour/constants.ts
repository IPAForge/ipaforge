/** The tour's stops in order: what each points at (its `data-tour`), with its title and note. */
export const tourStops = [
  'install',
  'preload',
  'apps',
  'devices',
  'developer',
  'pickers',
  'showAround',
  'logs',
  'settings'
] as const

export const tourStopKeys = {
  install: { title: 'tour.install.title', text: 'tour.install.text' },
  preload: { title: 'tour.preload.title', text: 'tour.preload.text' },
  apps: { title: 'tour.apps.title', text: 'tour.apps.text' },
  devices: { title: 'tour.devices.title', text: 'tour.devices.text' },
  developer: { title: 'tour.developer.title', text: 'tour.developer.text' },
  pickers: { title: 'tour.pickers.title', text: 'tour.pickers.text' },
  showAround: { title: 'tour.showAround.title', text: 'tour.showAround.text' },
  logs: { title: 'tour.logs.title', text: 'tour.logs.text' },
  settings: { title: 'tour.settings.title', text: 'tour.settings.text' }
} as const

/** The note's width and its gap from what it points at, in pixels. */
export const COACH_WIDTH = 320
export const COACH_GAP = 16
/** Room the spotlight leaves around its target. */
export const SPOT_PADDING = 4
