import { InputOTP, Label, REGEXP_ONLY_DIGITS } from '@heroui/react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'

/**
 * The code an Apple TV or Vision Pro shows, when a run asks it outside the pairing dialog. Digits left to right in
 * every language; a wrong one comes back as this question again (`retry`), for the new code on the device.
 */
export const PairingCodePrompt = ({
  data,
  onAnswer,
  onDecline,
  declineLabelKey,
  isPending = false
}: PromptProps<'device.pairing_code'>) => {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const labelId = useId()
  const name = data.deviceName
  const slots = Array.from({ length: data.codeLength }, (_, index) => index)

  return (
    <PromptShell
      title={t('pairByCode.code.title', { name })}
      description={t('pairByCode.code.body', { name })}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
      isPending={isPending}
      pendingKey="pairByCode.code.checking"
      submit={{
        labelKey: 'pairByCode.pair',
        isDisabled: code.length !== data.codeLength,
        onSubmit: () => onAnswer(code)
      }}
    >
      <Label id={labelId}>{t('pairByCode.code.label')}</Label>
      <div dir="ltr" className="flex justify-center">
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
      </div>
      {data.retry ? (
        <p role="alert" className="text-danger-soft-foreground text-sm">
          {t('pairByCode.code.wrong', { name })}
        </p>
      ) : null}
    </PromptShell>
  )
}
