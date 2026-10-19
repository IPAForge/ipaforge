import type { ExpiryTone } from '@ui/features/apps/types.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** Days until `expiresAt` (negative once it's past); undefined when it isn't known. */
export const daysLeft = (
  expiresAt: Date | undefined,
  now: Date
): number | undefined =>
  expiresAt ? (expiresAt.getTime() - now.getTime()) / DAY_MS : undefined

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
