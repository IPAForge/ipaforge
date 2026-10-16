import { Alert, Button, Input, Label, Modal, TextField } from '@heroui/react'
import { type SubmitEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { LoadstarError } from '@loadstar/kernel'
import { errorBodyKey, errorTitleKey } from '@ui/i18n/required-keys.ts'

/** Why the last attempt failed, in the words for its code (never the raw message). */
const SignInError = ({ error }: { error: LoadstarError }) => {
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

type SignInFormProps = {
  isBusy: boolean
  error: LoadstarError | undefined
  onSubmit: (appleId: string, password: string) => void
  onClose: () => void
}

/**
 * The Apple ID and password. It stays, read-only with Sign in busy, until Apple answers; after a failure the Apple
 * ID is kept and the password is typed again.
 */
export const SignInForm = ({
  isBusy,
  error,
  onSubmit,
  onClose
}: SignInFormProps) => {
  const { t } = useTranslation()
  const [appleId, setAppleId] = useState('')
  const [password, setPassword] = useState('')
  const isComplete = appleId.trim().length > 0 && password.length > 0
  useEffect(() => {
    if (error) setPassword('')
  }, [error])
  const onFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isComplete && !isBusy) onSubmit(appleId, password)
  }

  return (
    <form onSubmit={onFormSubmit} className="flex flex-col gap-4">
      <Modal.Header>
        <Modal.Heading>{t('signIn.title')}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-3">
        <p className="text-muted text-sm">{t('signIn.body')}</p>
        <TextField
          type="email"
          value={appleId}
          onChange={setAppleId}
          isReadOnly={isBusy}
          isRequired
          autoFocus
        >
          <Label>{t('signIn.appleId')}</Label>
          <Input autoComplete="username" />
        </TextField>
        <TextField
          type="password"
          value={password}
          onChange={setPassword}
          isReadOnly={isBusy}
          isRequired
        >
          <Label>{t('signIn.password')}</Label>
          <Input autoComplete="current-password" />
        </TextField>
        {error && !isBusy ? <SignInError error={error} /> : null}
        <p aria-live="polite" className="min-h-5 text-muted text-sm">
          {isBusy ? t('signIn.signingIn') : null}
        </p>
      </Modal.Body>
      <Modal.Footer className="flex justify-end gap-2">
        <Button variant="tertiary" onPress={onClose}>
          {t('prompts.cancel')}
        </Button>
        <Button type="submit" isDisabled={!isComplete} isPending={isBusy}>
          {t('signIn.submit')}
        </Button>
      </Modal.Footer>
    </form>
  )
}
