import { Alert, Button } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAccountView } from '@ui/features/accounts/hooks/use-account-view.ts'
import { SignInDialog } from '@ui/features/accounts/sign-in/sign-in-dialog.tsx'
import { useActiveAccount, useDevicesInUse } from '@ui/hooks/use-selection.ts'

/**
 * Says when the Apple ID in use needs signing in again, with a way to do it now: with what IPAForge saved, so it
 * asks only for what's missing (usually the code). It does not block installing: the run's sign-in step asks too.
 */
export const SignInNeededNotice = () => {
  const { t } = useTranslation()
  const account = useActiveAccount()
  const view = useAccountView(account, useDevicesInUse())
  const [isSigningIn, setSigningIn] = useState(false)
  const onSignInAgain = () => setSigningIn(true)
  const onClose = () => setSigningIn(false)
  // The account's queries refresh after the sign-in; the dialog stays for its "Signed in as …" step.
  const onSignedIn = () => undefined
  const dialog =
    isSigningIn && account ? (
      <SignInDialog
        appleId={account.appleId}
        accountId={account.id}
        onClose={onClose}
        onSignedIn={onSignedIn}
      />
    ) : null
  const isNeeded = account !== undefined && view.state === 'signInNeeded'

  // One shape whatever the state, so the dialog is not remounted when the notice goes away after the sign-in.
  return (
    <>
      {isNeeded ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('install.signInNeeded.title')}</Alert.Title>
            <Alert.Description>
              {t('install.signInNeeded.body', { appleId: account?.appleId })}
            </Alert.Description>
          </Alert.Content>
          <Button size="sm" onPress={onSignInAgain}>
            {t('accounts.signInAgain')}
          </Button>
        </Alert>
      ) : null}
      {dialog}
    </>
  )
}
