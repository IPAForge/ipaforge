import { useTranslation } from 'react-i18next'

import { ChoiceButton } from '@ui/components/prompts/choice-button.tsx'
import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'
import { useChosenAnswer } from '@ui/features/install/prompts/hooks/use-chosen-answer.ts'

/** The Apple ID has several teams: which one signs. One click; IPAForge remembers it for this Apple ID. */
export const TeamPrompt = ({
  data,
  onAnswer,
  onDecline,
  declineLabelKey,
  isPending = false
}: PromptProps<'apple.choose_team'>) => {
  const { t } = useTranslation()
  const { choose, busy } = useChosenAnswer(onAnswer, isPending)

  return (
    <PromptShell
      title={t('prompts.team.title')}
      description={t('prompts.team.body')}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
      isPending={isPending}
      pendingKey="prompts.team.checking"
    >
      {data.teams.map((team) => (
        <ChoiceButton
          key={team.id}
          title={
            team.isFree
              ? t('accounts.freeTeam', { name: team.name })
              : team.name
          }
          description={t(
            team.isFree ? 'prompts.team.free' : 'prompts.team.paid'
          )}
          onPress={choose(team.id, team.id)}
          {...busy(team.id)}
        />
      ))}
    </PromptShell>
  )
}
