import { Alert } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { toIPAForgeError } from '@ipaforge/kernel'
import { errorTitleKey } from '@ui/i18n/required-keys.ts'

type ActionErrorProps = {
  error: unknown
}

/** Why a change failed, by its error's title; nothing when it didn't. */
export const ActionError = ({ error }: ActionErrorProps) => {
  const { t } = useTranslation()
  if (!error) return null

  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {t(errorTitleKey(toIPAForgeError(error).code))}
        </Alert.Title>
      </Alert.Content>
    </Alert>
  )
}
