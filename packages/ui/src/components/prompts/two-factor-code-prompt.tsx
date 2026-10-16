import { InputOTP, Label, REGEXP_ONLY_DIGITS } from '@heroui/react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'

/**
 * The verification code. While Apple checks it, the step stays with Verify busy and the code locked; a wrong one
 * comes back as this step again (`retry`), which says so.
 */
export const TwoFactorCodePrompt = ({
  data,
  onAnswer,
  onDecline,
  declineLabelKey,
  isPending = false
}: PromptProps<'apple.two_factor_code'>) => {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const labelId = useId()
  const slots = Array.from({ length: data.codeLength }, (_, index) => index)

  return (
    <PromptShell
      title={t('prompts.code.title')}
      description={t('prompts.code.body', { length: data.codeLength })}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
      isPending={isPending}
      pendingKey="prompts.code.checking"
      submit={{
        labelKey: 'prompts.code.verify',
        isDisabled: code.length !== data.codeLength,
        onSubmit: () => onAnswer(code)
      }}
    >
      <Label id={labelId}>{t('prompts.code.label')}</Label>
      <InputOTP
        aria-labelledby={labelId}
        maxLength={data.codeLength}
        pattern={REGEXP_ONLY_DIGITS}
        value={code}
        onChange={setCode}
        isInvalid={data.retry}
        isDisabled={isPending}
        autoFocus
      >
        <InputOTP.Group>
          {slots.map((index) => (
            <InputOTP.Slot key={index} index={index} />
          ))}
        </InputOTP.Group>
      </InputOTP>
      {data.retry ? (
        <p role="alert" className="text-danger text-sm">
          {t('prompts.code.wrong')}
        </p>
      ) : null}
    </PromptShell>
  )
}
