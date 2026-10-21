import {
  Label,
  RadioButton,
  RadioField,
  RadioGroup
} from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import { cardClass } from '@ui/features/install/home/utils/choice-classes.ts'
import type { Team } from '@ui/services/engine/types.ts'

type TeamChoiceProps = {
  teams: readonly Team[]
  value: string
  onChange: (teamId: string) => void
}

/** Which of the Apple ID's teams signs the apps, each saying what its kind allows. */
export const TeamChoice = ({ teams, value, onChange }: TeamChoiceProps) => {
  const { t } = useTranslation()

  return (
    <RadioGroup
      value={value}
      onChange={onChange}
      className="flex flex-col gap-2"
    >
      <Label className="font-medium text-sm">{t('guide.appleid.team')}</Label>
      <div className="grid gap-3 sm:grid-cols-2">
        {teams.map((team) => (
          <RadioField key={team.id} value={team.id}>
            <RadioButton className={cardClass}>
              <span className="font-semibold">{team.name}</span>
              <span className="text-muted text-sm">
                {t(team.isFree ? 'guide.appleid.free' : 'guide.appleid.paid')}
              </span>
            </RadioButton>
          </RadioField>
        ))}
      </div>
    </RadioGroup>
  )
}
