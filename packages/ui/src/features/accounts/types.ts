import type { StatusTone } from '@ui/components/shell/types.ts'
import type { TeamsAnswer } from '@ui/hooks/queries/use-teams.ts'
import type { Account } from '@ui/services/engine/types.ts'

export type AccountState =
  | 'checking'
  | 'ready'
  | 'signInNeeded'
  | 'blocked'
  | 'unreachable'

export type TeamsStatus = {
  readonly data?: TeamsAnswer | undefined
  readonly error?: unknown
}

export type AccountView = {
  /** "Personal team (free) and Example Studio"; empty until Apple has answered. */
  readonly teams: string
  /** The teams, then the state when it is not ready ("… · Sign-in needed"). */
  readonly subtitle: string
  readonly state: AccountState | undefined
  /** The state in words, when it is not ready. */
  readonly stateText: string | undefined
  readonly tone: StatusTone
}

export type AccountRowActions = {
  onUse: (account: Account) => void
  onSignInAgain: (account: Account) => void
  onSignOut: (account: Account) => void
}
