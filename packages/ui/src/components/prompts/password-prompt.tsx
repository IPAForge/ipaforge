import { Input, Label, TextField } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'

/** The saved session expired: the Apple ID's password, sent to the Engine as the answer. */
export const PasswordPrompt = ({
  data,
  onAnswer,
  onDecline,
  declineLabelKey,
  isPending = false
}: PromptProps<'apple.password'>) => {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')

  return (
    <PromptShell
      title={t('prompts.password.title')}
      description={t('prompts.password.body', { appleId: data.appleId })}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
      isPending={isPending}
      pendingKey="prompts.password.checking"
      submit={{
        labelKey: 'prompts.continue',
        isDisabled: password.length === 0,
        onSubmit: () => onAnswer(password)
      }}
    >
      <TextField
        type="password"
        value={password}
        onChange={setPassword}
        isReadOnly={isPending}
        autoFocus
        isRequired
      >
        <Label>{t('prompts.password.label')}</Label>
        <Input autoComplete="current-password" />
      </TextField>
    </PromptShell>
  )
}
