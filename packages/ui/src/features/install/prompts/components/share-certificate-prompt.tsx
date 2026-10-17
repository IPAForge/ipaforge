import { useTranslation } from 'react-i18next'

import { ChoiceButton } from '@ui/components/prompts/choice-button.tsx'
import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'
import { useChosenAnswer } from '@ui/features/install/prompts/hooks/use-chosen-answer.ts'

/** An imported IPA looks like SideStore: whether it gets the signing certificate, so it can refresh apps itself. */
export const ShareCertificatePrompt = ({
  data,
  onAnswer,
  onDecline,
  declineLabelKey,
  isPending = false
}: PromptProps<'installer.share_certificate'>) => {
  const { t } = useTranslation()
  const { choose, busy } = useChosenAnswer(onAnswer, isPending)

  return (
    <PromptShell
      title={t('prompts.share.title', { app: data.appName })}
      description={t('prompts.share.body')}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
      isPending={isPending}
    >
      <ChoiceButton
        title={t('prompts.share.yes')}
        description={t('prompts.share.yesHint')}
        onPress={choose('share', true)}
        {...busy('share')}
      />
      <ChoiceButton
        title={t('prompts.share.no')}
        description={t('prompts.share.noHint')}
        onPress={choose('keep', false)}
        {...busy('keep')}
      />
    </PromptShell>
  )
}
