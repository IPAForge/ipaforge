import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

type TextCodeButtonProps = {
  phone: { readonly id: number; readonly number: string }
  isDisabled: boolean
  onText: (phoneId: number) => void
}

/** Sends the code by text message to one of the account's numbers instead. */
export const TextCodeButton = ({
  phone,
  isDisabled,
  onText
}: TextCodeButtonProps) => {
  const { t } = useTranslation()
  const onPress = () => onText(phone.id)

  return (
    <Button
      size="sm"
      variant="tertiary"
      isDisabled={isDisabled}
      onPress={onPress}
    >
      {t('prompts.code.textTo', { number: phone.number })}
    </Button>
  )
}
