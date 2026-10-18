import { useTranslation } from 'react-i18next'

import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'
import { AccountChoice } from '@ui/features/install/recovery/components/account-choice.tsx'
import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'

type SwitchAccountDialogProps = {
  /** The Apple ID the run used, marked "in use". */
  currentId: string
  /** The device the run installs on: an Apple ID blocked there can't be picked. */
  udid: string
  onChoose: (accountId: string) => void
  onClose: () => void
}

/** The saved Apple IDs to start the install again with; the one in use and those blocked on the device are off. */
export const SwitchAccountDialog = ({
  currentId,
  udid,
  onChoose,
  onClose
}: SwitchAccountDialogProps) => {
  const { t } = useTranslation()
  const accounts = useAccounts().data ?? []

  return (
    <PromptShell
      title={t('recovery.switchAccount.title')}
      description={t('recovery.switchAccount.body')}
      declineLabelKey="prompts.cancel"
      onDecline={onClose}
    >
      {accounts.map((account) => (
        <AccountChoice
          key={account.id}
          account={account}
          isBlocked={account.health.bannedOnDevices.includes(udid)}
          isCurrent={account.id === currentId}
          onChoose={onChoose}
        />
      ))}
    </PromptShell>
  )
}
