// What the Engine knows about a saved Apple ID, as the picker, the Accounts page and the Install page show it.
import type { AccountState, TeamsStatus } from '@ui/features/accounts/types.ts'
import type { Account } from '@ui/services/engine/types.ts'

/**
 * Blocked when Apple banned its profiles on one of `udids` (known locally, so shown at once). Otherwise what Apple
 * answered about its teams: "sign-in needed" for an expired session, ready with teams, unreachable when Apple
 * could not be asked, and "checking" until there is an answer, never ready before it.
 */
export const accountState = (
  account: Account,
  udids: readonly string[],
  teams: TeamsStatus
): AccountState => {
  if (udids.some((udid) => account.health.bannedOnDevices.includes(udid)))
    return 'blocked'
  if (teams.data?.kind === 'sign-in-needed') return 'signInNeeded'
  if (teams.data?.kind === 'teams') return 'ready'
  if (teams.error) return 'unreachable'
  return 'checking'
}
