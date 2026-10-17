import { Dropdown, Label } from '@heroui/react'
import { Plus } from 'lucide-react'
import { type Key, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AccountItem } from '@ui/components/shell/account-item.tsx'
import { ADD_APPLE_ID } from '@ui/components/shell/constants.ts'
import { NoAccounts } from '@ui/components/shell/no-accounts.tsx'
import { TopBarPicker } from '@ui/components/shell/top-bar-picker.tsx'
import { useAccountView } from '@ui/features/accounts/hooks/use-account-view.ts'
import { SignInDialog } from '@ui/features/accounts/sign-in/sign-in-dialog.tsx'
import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'
import {
  useActiveAccount,
  useDevicesInUse,
  useSelection
} from '@ui/hooks/use-selection.ts'
import type { Account } from '@ui/services/engine/types.ts'

/** Saved Apple IDs with their teams and state, picking the one in use, and "Add Apple ID…". */
export const AccountPicker = () => {
  const { t } = useTranslation()
  const [isSigningIn, setSigningIn] = useState(false)
  const accounts = useAccounts().data ?? []
  const active = useActiveAccount()
  const udids = useDevicesInUse()
  const view = useAccountView(active, udids)
  const { select } = useSelection()
  const onSelectionChange = useCallback(
    (keys: 'all' | Set<Key>) => {
      const [id] = keys === 'all' ? [] : keys
      if (typeof id === 'string') select('account', id)
    },
    [select]
  )
  const onAction = useCallback((key: Key) => {
    if (key === ADD_APPLE_ID) setSigningIn(true)
  }, [])
  const onDialogClose = useCallback(() => setSigningIn(false), [])
  const onSignedIn = useCallback(
    (account: Account) => select('account', account.id),
    [select]
  )

  return (
    <>
      <TopBarPicker
        label={t('topBar.account')}
        value={active?.appleId ?? t('topBar.notSignedIn')}
        tone={view.tone}
        status={
          view.state === 'signInNeeded' || view.state === 'blocked'
            ? view.stateText
            : undefined
        }
        menuLabel={t('topBar.accountMenu')}
        onAction={onAction}
      >
        {accounts.length > 0 ? (
          <Dropdown.Section
            selectionMode="single"
            selectedKeys={active ? [active.id] : []}
            onSelectionChange={onSelectionChange}
          >
            {accounts.map((account) => (
              <AccountItem key={account.id} account={account} udids={udids} />
            ))}
          </Dropdown.Section>
        ) : (
          <Dropdown.Section>
            <NoAccounts />
          </Dropdown.Section>
        )}
        <Dropdown.Section>
          <Dropdown.Item id={ADD_APPLE_ID} textValue={t('topBar.addAppleId')}>
            <Plus aria-hidden="true" className="size-4 shrink-0" />
            <Label>{t('topBar.addAppleId')}</Label>
          </Dropdown.Item>
        </Dropdown.Section>
      </TopBarPicker>
      {isSigningIn ? (
        <SignInDialog onClose={onDialogClose} onSignedIn={onSignedIn} />
      ) : null}
    </>
  )
}
