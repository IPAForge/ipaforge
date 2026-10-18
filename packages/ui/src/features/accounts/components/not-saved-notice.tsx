import { Alert } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { useCanSaveAccounts } from '@ui/hooks/queries/use-can-save-accounts.ts'

/** Says when Apple IDs are kept only until IPAForge quits, because the system keychain can't be used. */
export const NotSavedNotice = () => {
  const { t } = useTranslation()
  const canSave = useCanSaveAccounts().data

  if (canSave !== false) return null

  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('accounts.notSaved.title')}</Alert.Title>
        <Alert.Description>{t('accounts.notSaved.body')}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}
