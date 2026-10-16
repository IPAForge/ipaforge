import { useCallback, useState } from 'react'

import { TopBarPicker } from '@ui/components/shell/top-bar-picker.tsx'
import { SignInDialog } from '@ui/features/accounts/sign-in/sign-in-dialog.tsx'
import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'
import type { Account } from '@ui/services/engine/engine-types.ts'

/**
 * The Apple ID picker, for now: it shows the Apple ID just signed in (else the first saved one) and offers
 * "Add Apple ID…". Choosing between saved Apple IDs and their teams comes with the account picker.
 */
export const AccountPicker = () => {
  const [isSigningIn, setSigningIn] = useState(false)
  const [signedIn, setSignedIn] = useState<string | undefined>(undefined)
  const savedFirst = useAccounts().data?.[0]?.appleId
  const appleId = signedIn ?? savedFirst
  const onAddAppleId = useCallback(() => setSigningIn(true), [])
  const onDialogClose = useCallback(() => setSigningIn(false), [])
  const onSignedIn = useCallback(
    (account: Account) => setSignedIn(account.appleId),
    []
  )

  return (
    <>
      <TopBarPicker
        name="account"
        labelKey="topBar.account"
        valueKey="topBar.notSignedIn"
        value={appleId}
        isOn={appleId !== undefined}
        menuLabelKey="topBar.accountMenu"
        emptyItemKey="topBar.addAppleId"
        onItemAction={onAddAppleId}
      />
      {isSigningIn ? (
        <SignInDialog onClose={onDialogClose} onSignedIn={onSignedIn} />
      ) : null}
    </>
  )
}
