import type { TFunction } from 'i18next'

import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'

/** Where the code went: the trusted devices, a text message to a number, or (older accounts) "Apple sent". */
export const codeDescription = (
  t: TFunction,
  {
    method,
    codeLength,
    phones = []
  }: PromptProps<'apple.two_factor_code'>['data']
): string => {
  if (method.type === 'trusted_device')
    return t('prompts.code.deviceBody', { length: codeLength })
  if (method.type === 'sms') {
    const phone = phones.find((candidate) => candidate.id === method.phoneId)
    if (phone)
      return t('prompts.code.smsBody', {
        length: codeLength,
        number: phone.number
      })
  }
  return t('prompts.code.body', { length: codeLength })
}
