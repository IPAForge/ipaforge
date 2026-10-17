import { Alert } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import type { LoadstarError } from '@loadstar/kernel'
import { errorBodyKey, errorTitleKey } from '@ui/i18n/required-keys.ts'

type SignInErrorProps = { error: LoadstarError }

/** Why the last attempt failed, in the words for its code (never the raw message). */
export const SignInError = ({ error }: SignInErrorProps) => {
  const { t } = useTranslation()

  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t(errorTitleKey(error.code))}</Alert.Title>
        <Alert.Description>{t(errorBodyKey(error.code))}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}
