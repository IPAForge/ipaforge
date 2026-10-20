import { ListBox, Select } from '@heroui/react'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'

import type { Team } from '@ui/services/engine/types.ts'

type TeamPickerProps = {
  teams: readonly Team[]
  team: Team
  onChange: (teamId: string) => void
}

/** Which of the Apple ID's teams the page shows, when it has more than one. */
export const TeamPicker = ({ teams, team, onChange }: TeamPickerProps) => {
  const { t } = useTranslation()
  const onSelect = (key: Key | null) => {
    if (key !== null) onChange(String(key))
  }

  return (
    <Select
      aria-label={t('portal.team.pick')}
      value={team.id}
      onChange={onSelect}
      className="w-full max-w-xs"
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {teams.map((candidate) => {
            const label = t(
              candidate.isFree ? 'portal.team.free' : 'portal.team.paid',
              { name: candidate.name }
            )

            return (
              <ListBox.Item
                key={candidate.id}
                id={candidate.id}
                textValue={label}
              >
                {label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )
          })}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
