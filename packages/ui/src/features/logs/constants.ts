import type { LogLevel } from '@ipaforge/kernel'
import type { LogsEmptyKind } from '@ui/features/logs/types.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'
import type { LogArea } from '@ui/state/log-view/types.ts'

/** The scopes each area covers, and everything under them (`device` also covers `device.afc`). */
export const LOG_AREA_SCOPES = {
  install: ['installer'],
  device: ['device', 'device-watch'],
  apple: ['apple'],
  catalog: ['catalog'],
  signing: ['signer'],
  engine: ['engine', 'rpc'],
  interface: ['ui'],
  app: ['desktop']
} as const satisfies Readonly<Record<LogArea, readonly string[]>>

export const LOG_AREAS = Object.keys(LOG_AREA_SCOPES) as readonly LogArea[]

/** The area select's "All areas" option. */
export const ALL_AREAS = 'all'

export const LOG_AREA_KEYS = {
  install: 'logs.area.install',
  device: 'logs.area.device',
  apple: 'logs.area.apple',
  catalog: 'logs.area.catalog',
  signing: 'logs.area.signing',
  engine: 'logs.area.engine',
  interface: 'logs.area.interface',
  app: 'logs.area.app'
} as const satisfies Readonly<Record<LogArea, TranslationKey>>

/** The level filter, from everything to errors only. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const

export const LEVEL_FILTER_KEYS = {
  debug: 'logs.level.all',
  info: 'logs.level.info',
  warn: 'logs.level.warn',
  error: 'logs.level.error'
} as const satisfies Readonly<Record<LogLevel, TranslationKey>>

export const LEVEL_NAME_KEYS = {
  debug: 'logs.levelName.debug',
  info: 'logs.levelName.info',
  warn: 'logs.levelName.warn',
  error: 'logs.levelName.error'
} as const satisfies Readonly<Record<LogLevel, TranslationKey>>

export const LEVEL_BADGE_CLASSES = {
  debug: 'text-muted',
  info: 'bg-surface-secondary text-accent',
  warn: 'bg-warning-soft text-warning-soft-foreground',
  error: 'bg-danger-soft text-danger-soft-foreground'
} as const satisfies Readonly<Record<LogLevel, string>>

export const ROW_TONE_CLASSES = {
  debug: '',
  info: '',
  warn: 'bg-warning-soft/40',
  error: 'bg-danger-soft/50'
} as const satisfies Readonly<Record<LogLevel, string>>

/** Lines asked of the Engine at a time, newest first, as the list scrolls up. */
export const LOG_PAGE_SIZE = 200

/** Search runs in the Engine; wait for a pause in typing before asking. */
export const SEARCH_DELAY_MS = 250

/** A collapsed row's height before it is measured. */
export const ROW_HEIGHT_ESTIMATE = 30

/** Rows rendered above and below the visible ones. */
export const ROW_OVERSCAN = 12

/** Ask for older lines when this few rows are left above the visible ones. */
export const LOAD_OLDER_WITHIN_ROWS = 20

/** Within this many pixels of the bottom counts as at the bottom (following new lines). */
export const AT_BOTTOM_PX = 8

/** How long "Copied" and similar notes stay. */
export const NOTE_TIMEOUT_MS = 3000

export const LOG_FILE_PREFIX = 'ipaforge-logs'

export const EMPTY_TEXT_KEYS = {
  none: ['logs.empty.none.title', 'logs.empty.none.body'],
  'no-match': ['logs.empty.noMatch.title', 'logs.empty.noMatch.body'],
  cleared: ['logs.empty.cleared.title', 'logs.empty.cleared.body'],
  failed: ['logs.empty.failed.title', 'logs.empty.failed.body']
} as const satisfies Readonly<
  Record<LogsEmptyKind, readonly [TranslationKey, TranslationKey]>
>
