import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'
import { PickList } from '@ui/features/install/prompts/components/pick-list.tsx'
import { useCertificateOptions } from '@ui/features/install/prompts/hooks/use-certificate-options.ts'

/**
 * The team has no room for another certificate: which one to revoke. It is picked, then confirmed with a red
 * button, because apps signed with it stop refreshing.
 */
export const RevokeCertificatePrompt = ({
  data,
  onAnswer,
  onDecline,
  declineLabelKey,
  isPending = false
}: PromptProps<'apple.revoke_certificate'>) => {
  const { t } = useTranslation()
  const options = useCertificateOptions(data.certificates)
  const [picked, setPicked] = useState<string | undefined>(undefined)
  const onConfirm = () => {
    if (picked) onAnswer(picked)
  }

  return (
    <PromptShell
      title={t('prompts.revoke.title')}
      description={t('prompts.revoke.body')}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
      isPending={isPending}
      pendingKey="prompts.revoke.revoking"
      submit={{
        labelKey: 'prompts.revoke.confirm',
        isDisabled: !picked,
        isDestructive: true,
        onSubmit: onConfirm
      }}
    >
      <PickList
        label={t('prompts.revoke.title')}
        options={options}
        value={picked}
        onChange={setPicked}
        isDisabled={isPending}
      />
    </PromptShell>
  )
}
