import { Button, Chip } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { StatusDot } from '@ui/components/shell/status-dot.tsx'
import type { AccountState } from '@ui/features/accounts/account-state.ts'
import { useAccountView } from '@ui/features/accounts/use-account-view.ts'
import type { Account } from '@ui/services/engine/engine-types.ts'

const stateClasses = {
  checking: 'text-muted',
  ready: '',
  signInNeeded: 'text-warning',
  blocked: 'text-danger',
  unreachable: 'text-warning'
} as const satisfies Record<AccountState, string>

export type AccountRowActions = {
  onUse: (account: Account) => void
  onSignInAgain: (account: Account) => void
  onSignOut: (account: Account) => void
}

type AccountRowProps = AccountRowActions & {
  account: Account
  isInUse: boolean
  udids: readonly string[]
}

/** One saved Apple ID: its teams and state, "in use" for the active one, and what can be done with it. */
export const AccountRow = ({
  account,
  isInUse,
  udids,
  onUse,
  onSignInAgain,
  onSignOut
}: AccountRowProps) => {
  const { t } = useTranslation()
  const view = useAccountView(account, udids)
  const onUseThis = () => onUse(account)
  const onSignInAgainThis = () => onSignInAgain(account)
  const onSignOutThis = () => onSignOut(account)

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <StatusDot tone={view.tone} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          <span className="truncate">{account.appleId}</span>
          {isInUse ? (
            <Chip size="sm" color="accent">
              {t('accounts.inUse')}
            </Chip>
          ) : null}
        </span>
        <span className="text-muted text-sm">
          {view.teams || t('accounts.noTeams')}
        </span>
        {view.stateText ? (
          <span className={`text-sm ${stateClasses[view.state ?? 'checking']}`}>
            {view.stateText}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {view.state === 'signInNeeded' ? (
          <Button size="sm" onPress={onSignInAgainThis}>
            {t('accounts.signInAgain')}
          </Button>
        ) : null}
        {isInUse ? null : (
          <Button size="sm" variant="secondary" onPress={onUseThis}>
            {t('accounts.use')}
          </Button>
        )}
        <Button size="sm" variant="tertiary" onPress={onSignOutThis}>
          {t('accounts.signOut.action')}
        </Button>
      </div>
    </li>
  )
}
