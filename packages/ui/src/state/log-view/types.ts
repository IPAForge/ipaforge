import type { LogLevel } from '@ipaforge/kernel'

/** Where a line comes from, as the viewer groups scopes (see `features/logs/constants.ts`). */
export type LogArea =
  | 'install'
  | 'device'
  | 'apple'
  | 'catalog'
  | 'signing'
  | 'engine'
  | 'interface'
  | 'app'

/** An install run's time span (ISO); `to` is missing while it runs. */
export type RunWindow = {
  readonly from: string
  readonly to?: string | undefined
}

/** What the log viewer shows, kept outside the page so it stays when the user leaves Logs and comes back. */
export type LogViewState = {
  readonly minLevel: LogLevel
  readonly area?: LogArea | undefined
  readonly text: string
  readonly run?: RunWindow | undefined
  /** Lines up to this number were cleared from the view (0: none). */
  readonly clearedAfter: number
}

export type LogViewStore = {
  getState: () => LogViewState
  subscribe: (listener: () => void) => () => void
  setMinLevel: (level: LogLevel) => void
  setArea: (area: LogArea | undefined) => void
  setText: (text: string) => void
  /** Only the lines of one install run ("Show logs" in the recovery box). */
  showRun: (run: RunWindow) => void
  clearRun: () => void
  /** Hides what is on screen; the buffer, and a saved file, keep every line. */
  clear: (lastSeq: number) => void
  /** Every filter off: all levels, all areas, no search, no run. */
  showAll: () => void
}
