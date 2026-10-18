import type { LogLevelControl } from '@kernel/logging/types.ts'
import type { LogLevel } from '@kernel/ports/types.ts'

/** A level the app can change at runtime (the log viewer's "Include debug details"). */
export const createLogLevel = (initial: LogLevel): LogLevelControl => {
  let level = initial

  return {
    get: () => level,
    set: (next) => {
      level = next
    }
  }
}
