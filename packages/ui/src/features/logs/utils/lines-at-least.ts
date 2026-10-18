import { isLevelAtLeast, type LogLevel } from '@ipaforge/kernel'
import { LOG_LEVELS } from '@ui/features/logs/constants.ts'

/** How many lines a minimum level shows, from the count per level. */
export const linesAtLeast = (
  counts: Readonly<Record<LogLevel, number>>,
  minLevel: LogLevel
): number =>
  LOG_LEVELS.filter((level) => isLevelAtLeast(level, minLevel)).reduce(
    (total, level) => total + counts[level],
    0
  )
