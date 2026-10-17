import { Button } from '@heroui/react'
import { CheckboxGroup, Label } from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import type { PromptProps } from '@ui/components/prompts/prompt-props.ts'
import { PromptShell } from '@ui/components/prompts/prompt-shell.tsx'
import { PairingAppRow } from '@ui/features/install/prompts/components/pairing-app-row.tsx'
import { usePairingChoice } from '@ui/features/install/prompts/hooks/use-pairing-choice.ts'

/** Which apps on the device get the pairing file: ticked rows, Select all, and a button that counts them. */
export const PairingAppsPrompt = ({
  data,
  onAnswer,
  onDecline,
  declineLabelKey,
  isPending = false
}: PromptProps<'device.choose_pairing_apps'>) => {
  const { t } = useTranslation()
  const { chosen, isAllChosen, setChosen, toggleAll } = usePairingChoice(
    data.apps
  )
  const onPlace = () => onAnswer(chosen)

  return (
    <PromptShell
      title={t('prompts.pairing.title')}
      description={t('prompts.pairing.body')}
      declineLabelKey={declineLabelKey}
      onDecline={onDecline}
      isPending={isPending}
      pendingKey="prompts.pairing.placing"
      submit={{
        labelKey: 'prompts.pairing.place',
        labelValues: { count: chosen.length },
        isDisabled: chosen.length === 0,
        onSubmit: onPlace
      }}
    >
      <CheckboxGroup
        value={chosen}
        onChange={setChosen}
        isDisabled={isPending}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center justify-between text-muted text-sm">
          <Label>
            {t('prompts.pairing.available', { count: data.apps.length })}
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onPress={toggleAll}
            isDisabled={isPending}
          >
            {t(
              isAllChosen
                ? 'prompts.pairing.clearAll'
                : 'prompts.pairing.selectAll'
            )}
          </Button>
        </div>
        {data.apps.map((app) => (
          <PairingAppRow key={app.bundleId} app={app} />
        ))}
      </CheckboxGroup>
    </PromptShell>
  )
}
