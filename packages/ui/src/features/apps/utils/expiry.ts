import type { ExpiryTone } from '@ui/features/apps/types.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** Days until `expiresAt` (negative once it's past); undefined when it isn't known. */
export const daysLeft = (
  expiresAt: Date | undefined,
  now: Date
): number | undefined =>
  expiresAt ? (expiresAt.getTime() - now.getTime()) / DAY_MS : undefined

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/**
 * Calendar days from `now` to `expiresAt` in local time, the hour ignored, as SideStore counts them: a profile
 * made today for 7 days says 7, one ending later today says 0 (negative once past days). Rounded, so a daylight
 * saving change in between doesn't make a day 23 or 25 hours long.
 */
export const calendarDaysLeft = (
  expiresAt: Date | undefined,
  now: Date
): number | undefined =>
  expiresAt
    ? Math.round((startOfDay(expiresAt) - startOfDay(now)) / DAY_MS)
    : undefined

/** Expired, inside the refresh window (`daysBefore`), fine, or unknown. */
export const expiryTone = (
  days: number | undefined,
  daysBefore: number
): ExpiryTone => {
  if (days === undefined) return 'unknown'
  if (days <= 0) return 'expired'
  if (days <= daysBefore) return 'soon'

  return 'ok'
}

/** When an app enters the refresh window, in ms since the epoch. */
export const dueAt = (expiresAt: Date, daysBefore: number): number =>
  expiresAt.getTime() - daysBefore * DAY_MS
