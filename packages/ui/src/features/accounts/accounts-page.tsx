import { Button, Card } from '@heroui/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@ui/components/page-header.tsx'
import { AccountRow } from '@ui/features/accounts/components/account-row.tsx'
import { SignOutDialog } from '@ui/features/accounts/components/sign-out-dialog.tsx'
import { SignInDialog } from '@ui/features/accounts/sign-in/sign-in-dialog.tsx'
import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'
import {
  useActiveAccount,
  useDevicesInUse,
  useSelection
} from '@ui/hooks/use-selection.ts'
import type { Account } from '@ui/services/engine/types.ts'

/** Which dialog is open: sign-in (maybe again, for a saved Apple ID) or the sign-out confirmation. */
type OpenDialog =
  | { readonly kind: 'sign-in'; readonly appleId?: string | undefined }
  | { readonly kind: 'sign-out'; readonly account: Account }
  | undefined

/** Manage → Accounts: every saved Apple ID with its teams and state, to use, sign in again or sign out. */
export const AccountsPage = () => {
  const { t } = useTranslation()
  const accounts = useAccounts().data ?? []
  const active = useActiveAccount()
  const udids = useDevicesInUse()
  const { select } = useSelection()
  const [dialog, setDialog] = useState<OpenDialog>(undefined)
  const onClose = () => setDialog(undefined)
  const onAddAppleId = () => setDialog({ kind: 'sign-in' })
  const onUse = (account: Account) => select('account', account.id)
  const onSignInAgain = (account: Account) =>
    setDialog({ kind: 'sign-in', appleId: account.appleId })
  const onSignOut = (account: Account) =>
    setDialog({ kind: 'sign-out', account })
  // Signing out the Apple ID in use hands its place to the next saved one; with none left, nothing is in use.
  const onSignedOut = (account: Account) => {
    const next = accounts.find((other) => other.id !== account.id)
    if (account.id === active?.id && next) select('account', next.id)
    onClose()
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          titleKey="nav.accounts"
          descriptionKey="accounts.description"
        />
        <Button onPress={onAddAppleId}>
          <Plus aria-hidden="true" className="size-4" />
          {t('topBar.addAppleId')}
        </Button>
      </div>
      <Card>
        <Card.Content>
          {accounts.length > 0 ? (
            <ul
              aria-label={t('accounts.list')}
              className="flex flex-col divide-y divide-separator"
            >
              {accounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  isInUse={account.id === active?.id}
                  udids={udids}
                  onUse={onUse}
                  onSignInAgain={onSignInAgain}
                  onSignOut={onSignOut}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted">{t('accounts.empty')}</p>
          )}
        </Card.Content>
      </Card>
      {dialog?.kind === 'sign-in' ? (
        <SignInDialog
          appleId={dialog.appleId}
          onClose={onClose}
          onSignedIn={onUse}
        />
      ) : null}
      {dialog?.kind === 'sign-out' ? (
        <SignOutDialog
          account={dialog.account}
          onClose={onClose}
          onSignedOut={onSignedOut}
        />
      ) : null}
    </div>
  )
}
