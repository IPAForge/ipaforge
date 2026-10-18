import type { LogEntry, LogLevel } from '@ipaforge/kernel'

/** The lines loaded so far for the current filters, oldest first, and how to get more. */
export type LogLines = {
  readonly entries: readonly LogEntry[]
  readonly counts: Readonly<Record<LogLevel, number>>
  readonly hasOlder: boolean
  readonly isLoading: boolean
  readonly isLoadingOlder: boolean
  readonly isError: boolean
  loadOlder: () => void
  /** The newest line's number, for Clear. */
  readonly lastSeq: number
}

export type ExportKind = 'copy' | 'save'

/** A short note under the header after Copy, Save or Clear. */
export type LogsNote =
  | {
      readonly key: 'logs.export.copied' | 'logs.export.saved'
      readonly count: number
    }
  | {
      readonly key:
        | 'logs.export.copyFailed'
        | 'logs.export.saveFailed'
        | 'logs.cleared'
    }

export type FollowState = {
  readonly isFollowing: boolean
  /** New lines that arrived while not following. */
  readonly unseen: number
}

/** Why the list is empty. */
export type LogsEmptyKind = 'none' | 'no-match' | 'cleared' | 'failed'
