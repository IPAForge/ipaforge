import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'
import { PickList } from '@ui/features/install/prompts/components/pick-list.tsx'

/**
 * The device is at its free-app limit: which app to remove to make room. It is picked, then confirmed with a red
 * button; it can be installed again later.
 */
export const RemoveAppPrompt = ({
  data,
  onAnswer,
  onDecline,
  declineLabelKey,
  isPending = false
}: PromptProps<'device.choose_app_to_remove'>) => {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<string | undefined>(undefined)
  const options = data.apps.map((app) => ({
    value: app.bundleId,
    title: app.name ?? app.bundleId,
    description: app.name ? app.bundleId : undefined
  }))
  const onConfirm = () => {
    if (picked) onAnswer(picked)
  }

  return (
    <PromptShell
      title={t('prompts.remove.title')}
      description={t('prompts.remove.body', { limit: data.limit })}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
      isPending={isPending}
      pendingKey="prompts.remove.removing"
      submit={{
        labelKey: 'prompts.remove.confirm',
        isDisabled: !picked,
        isDestructive: true,
        onSubmit: onConfirm
      }}
    >
      <PickList
        label={t('prompts.remove.title')}
        options={options}
        value={picked}
        onChange={setPicked}
        isDisabled={isPending}
      />
    </PromptShell>
  )
}
