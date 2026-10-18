import { useTranslation } from 'react-i18next'

import { ChoiceButton } from '@ui/components/prompts/choice-button.tsx'
import type { Account } from '@ui/services/engine/types.ts'

type AccountChoiceProps = {
  account: Account
  isBlocked: boolean
  isCurrent: boolean
  onChoose: (accountId: string) => void
}

/** One saved Apple ID to start again with: off when it is the one that failed or is blocked on the device. */
export const AccountChoice = ({
  account,
  isBlocked,
  isCurrent,
  onChoose
}: AccountChoiceProps) => {
  const { t } = useTranslation()
  const onPress = () => onChoose(account.id)
  const note = () => {
    if (isBlocked) return t('accounts.state.blocked')
    if (isCurrent) return t('accounts.inUse')
    return undefined
  }

  return (
    <ChoiceButton
      title={account.appleId}
      description={note()}
      isDisabled={isBlocked || isCurrent}
      onPress={onPress}
    />
  )
}
