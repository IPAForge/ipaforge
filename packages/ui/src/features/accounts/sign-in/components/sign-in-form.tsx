import {
  Button,
  Checkbox,
  Description,
  Input,
  Label,
  Modal,
  TextField
} from '@heroui/react'
import { type SubmitEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { LoadstarError } from '@loadstar/kernel'
import { SignInError } from '@ui/features/accounts/sign-in/components/sign-in-error.tsx'

type SignInFormProps = {
  /** Filled in already (signing in again with a saved Apple ID). */
  initialAppleId?: string | undefined
  isBusy: boolean
  error: LoadstarError | undefined
  onSubmit: (
    appleId: string,
    password: string,
    rememberPassword: boolean
  ) => void
  onClose: () => void
}

/**
 * The Apple ID and password. It stays, read-only with Sign in busy, until Apple answers; after a failure the Apple
 * ID is kept and the password is typed again.
 */
export const SignInForm = ({
  initialAppleId,
  isBusy,
  error,
  onSubmit,
  onClose
}: SignInFormProps) => {
  const { t } = useTranslation()
  const [appleId, setAppleId] = useState(initialAppleId ?? '')
  const [password, setPassword] = useState('')
  const [rememberPassword, setRememberPassword] = useState(true)
  const isComplete = appleId.trim().length > 0 && password.length > 0
  useEffect(() => {
    if (error) setPassword('')
  }, [error])
  const onFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isComplete && !isBusy) onSubmit(appleId, password, rememberPassword)
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
          autoFocus={!initialAppleId}
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
          autoFocus={Boolean(initialAppleId)}
        >
          <Label>{t('signIn.password')}</Label>
          <Input autoComplete="current-password" />
        </TextField>
        <Checkbox
          isSelected={rememberPassword}
          onChange={setRememberPassword}
          isReadOnly={isBusy}
          className="flex w-full flex-row items-start justify-start gap-3 text-start"
        >
          <Checkbox.Control className="mt-0.5 shrink-0">
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Content className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-start">
            <Label className="text-sm">{t('signIn.rememberPassword')}</Label>
            <Description className="text-muted text-xs">
              {t('signIn.rememberPasswordHint')}
            </Description>
          </Checkbox.Content>
        </Checkbox>
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
