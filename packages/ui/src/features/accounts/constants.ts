import type { StatusTone } from '@ui/components/shell/types.ts'
import type { AccountState } from '@ui/features/accounts/types.ts'

export const accountTone = {
  checking: 'off',
  ready: 'ready',
  signInNeeded: 'warning',
  blocked: 'danger',
  unreachable: 'warning'
} as const satisfies Record<AccountState, StatusTone>

/** The state's words on an account row, in its tone's colour. */
export const accountStateClasses = {
  checking: 'text-muted',
  ready: '',
  signInNeeded: 'text-warning-soft-foreground',
  blocked: 'text-danger-soft-foreground',
  unreachable: 'text-warning-soft-foreground'
} as const satisfies Record<AccountState, string>
