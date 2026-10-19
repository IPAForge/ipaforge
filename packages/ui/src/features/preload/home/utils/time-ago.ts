import type { Formatters } from '@ui/i18n/formatters.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "3 minutes ago", "2 hours ago", "yesterday": how long ago `then` was, in the largest unit that fits. */
export const timeAgo = (
  then: Date,
  now: Date,
  relativeTime: Formatters['relativeTime']
): string => {
  const elapsed = Math.max(0, now.getTime() - then.getTime())

  if (elapsed < HOUR)
    return relativeTime(-Math.round(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return relativeTime(-Math.round(elapsed / HOUR), 'hour')

  return relativeTime(-Math.round(elapsed / DAY), 'day')
}
