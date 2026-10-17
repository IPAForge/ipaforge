import { Dropdown, Label } from '@heroui/react'
import { Plus } from 'lucide-react'
import { type Key, useCallback, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PickerItem } from '@ui/components/shell/picker-item.tsx'
import { TopBarPicker } from '@ui/components/shell/top-bar-picker.tsx'
import { SignInDialog } from '@ui/features/accounts/sign-in/sign-in-dialog.tsx'
import { useAccountView } from '@ui/features/accounts/use-account-view.ts'
import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'
import {
  useActiveAccount,
  useDevicesInUse,
  useSelection
} from '@ui/hooks/use-selection.ts'
import type { Account } from '@ui/services/engine/engine-types.ts'

const ADD_APPLE_ID = 'add-apple-id'

type AccountItemProps = { account: Account; udids: readonly string[] }

const AccountItem = ({ account, udids }: AccountItemProps) => {
  const view = useAccountView(account, udids)

  return (
    <PickerItem
      id={account.id}
      title={account.appleId}
      subtitle={view.subtitle}
      tone={view.tone}
    />
  )
}

const NoAccounts = () => {
  const { t } = useTranslation()
  const id = useId()

  return (
    <Dropdown.Item id={id} isDisabled textValue={t('topBar.noAccounts')}>
      <span className="text-muted text-sm">{t('topBar.noAccounts')}</span>
    </Dropdown.Item>
  )
}

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
