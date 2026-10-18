import type { LogEntry } from '@ipaforge/kernel'

const LEVEL_WIDTH = 5

/** One line of text for Copy and Save: time, level, scope, message and the fields as JSON. */
export const logLineText = (entry: LogEntry): string => {
  const fields = Object.keys(entry.fields).length
    ? ` ${JSON.stringify(entry.fields)}`
    : ''

  return `${entry.ts} ${entry.level.toUpperCase().padEnd(LEVEL_WIDTH)} ${entry.scope ?? '-'} ${entry.msg}${fields}`
}
