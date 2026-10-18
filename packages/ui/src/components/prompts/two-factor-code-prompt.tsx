import { Button, InputOTP, Label, REGEXP_ONLY_DIGITS } from '@heroui/react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'
import { TextCodeButton } from '@ui/components/prompts/text-code-button.tsx'
import { codeDescription } from '@ui/components/prompts/utils/code-description.ts'

/**
 * The verification code: where it went (the trusted devices, or a text message to a number), and "Didn't get a
 * code?" with Send a new code and, for trusted devices, Text a number instead. While Apple checks the code (or
 * sends a new one) the step stays busy; a wrong code comes back as this step again (`retry`), which says so.
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
  const [isSending, setSending] = useState(false)
  const labelId = useId()
  const slots = Array.from({ length: data.codeLength }, (_, index) => index)
  const isDevice = data.method.type === 'trusted_device'
  const phones = data.phones ?? []
  const onResend = () => {
    setSending(true)
    onAnswer({ resend: true })
  }
  const onText = (phoneId: number) => {
    setSending(true)
    onAnswer({ textTo: phoneId })
  }

  return (
    <PromptShell
      title={t('prompts.code.title')}
      description={codeDescription(t, data)}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
      isPending={isPending}
      pendingKey={isSending ? 'prompts.code.sending' : 'prompts.code.checking'}
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
        <p role="alert" className="text-danger-soft-foreground text-sm">
          {t('prompts.code.wrong')}
        </p>
      ) : null}
      {data.resent === true ? (
        <p role="status" className="text-sm">
          {t('prompts.code.sent')}
        </p>
      ) : null}
      {data.resent === false ? (
        <p role="alert" className="text-danger-soft-foreground text-sm">
          {t('prompts.code.notSent')}
        </p>
      ) : null}
      {isDevice ? (
        <p className="text-muted text-sm">{t('prompts.code.allowHint')}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-muted">{t('prompts.code.noCode')}</span>
        <Button
          size="sm"
          variant="tertiary"
          isDisabled={isPending}
          onPress={onResend}
        >
          {t('prompts.code.resend')}
        </Button>
        {isDevice
          ? phones.map((phone) => (
              <TextCodeButton
                key={phone.id}
                phone={phone}
                isDisabled={isPending}
                onText={onText}
              />
            ))
          : null}
      </div>
    </PromptShell>
  )
}
