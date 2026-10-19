import type { AutoRefreshSettings } from '@ui/state/auto-refresh/types.ts'

/** Where the settings are kept between launches. */
export const AutoRefreshKey = {
  isOn: 'apps.autoRefresh',
  daysBefore: 'apps.autoRefreshDays'
} as const

/** On by default, two days before an app expires. */
export const DEFAULT_AUTO_REFRESH: AutoRefreshSettings = {
  isOn: true,
  daysBefore: 2
}

/** The choices for "refresh when an app has … left". */
export const AUTO_REFRESH_DAYS = [1, 2, 3] as const
