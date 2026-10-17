import { useTranslation } from 'react-i18next'

import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'
import type { RunPromptActions } from '@ui/features/install/prompts/types.ts'

type NotYetAskedProps = RunPromptActions

/** A question this version doesn't know (from a newer Engine): it says so and offers to cancel. */
export const NotYetAsked = ({
  onDecline,
  declineLabelKey
}: NotYetAskedProps) => {
  const { t } = useTranslation()

  return (
    <PromptShell
      title={t('install.run.unsupportedPrompt.title')}
      description={t('install.run.unsupportedPrompt.body')}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
    />
  )
}
