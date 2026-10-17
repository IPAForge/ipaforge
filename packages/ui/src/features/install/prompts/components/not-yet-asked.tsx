import { useTranslation } from 'react-i18next'

import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'
import type { RunPromptActions } from '@ui/features/install/prompts/types.ts'
import { questionKey } from '@ui/features/install/prompts/utils/question-key.ts'

type NotYetAskedProps = RunPromptActions & { kind: string }

/** Says the run asked a question this version can't ask yet, and offers to cancel. */
export const NotYetAsked = ({
  kind,
  onDecline,
  declineLabelKey
}: NotYetAskedProps) => {
  const { t } = useTranslation()

  return (
    <PromptShell
      title={t('install.run.unsupportedPrompt.title')}
      description={t('install.run.unsupportedPrompt.body', {
        question: t(questionKey(kind))
      })}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
    />
  )
}
