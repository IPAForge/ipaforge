import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChoiceButton } from '@ui/components/prompts/choice-button.tsx'
import { TRUSTED_DEVICE } from '@ui/components/prompts/constants.ts'
import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'
import type { TwoFactorMethod } from '@ui/services/engine/types.ts'

/**
 * Where Apple should send the code: a trusted device, or a text message to one of the account's numbers. While
 * Apple sends it, the chosen option shows it is busy and the others wait.
 */
export const TwoFactorMethodPrompt = ({
  data,
  onAnswer,
  onDecline,
  declineLabelKey,
  isPending = false
}: PromptProps<'apple.two_factor_method'>) => {
  const { t } = useTranslation()
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const onChoose = (key: string, method: TwoFactorMethod) => () => {
    if (isPending) return
    setChosen(key)
    onAnswer(method)
  }
  const busy = (key: string) => ({
    isPending: isPending && chosen === key,
    isDisabled: isPending && chosen !== key
  })

  return (
    <PromptShell
      title={t('prompts.method.title')}
      description={t('prompts.method.body')}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
      isPending={isPending}
      pendingKey="prompts.method.sending"
    >
      {data.methods.trustedDevice ? (
        <ChoiceButton
          title={t('prompts.method.trustedDevice')}
          description={t('prompts.method.trustedDeviceHint')}
          onPress={onChoose(TRUSTED_DEVICE, { type: 'trusted_device' })}
          {...busy(TRUSTED_DEVICE)}
        />
      ) : null}
      {data.methods.phones.map((phone) => (
        <ChoiceButton
          key={phone.id}
          title={t('prompts.method.sms', { number: phone.number })}
          description={t('prompts.method.smsHint')}
          onPress={onChoose(`sms-${phone.id}`, {
            type: 'sms',
            phoneId: phone.id
          })}
          {...busy(`sms-${phone.id}`)}
        />
      ))}
    </PromptShell>
  )
}
