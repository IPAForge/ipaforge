import { ToggleButton, ToggleButtonGroup } from '@heroui/react'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'

import {
  anisetteModes,
  modeHintKeys,
  modeLabelKeys
} from '@ui/features/settings/anisette/constants.ts'
import type { AnisetteChoice } from '@ui/services/engine/types.ts'

type ModeSwitchProps = {
  choice: AnisetteChoice
  onChange: (mode: AnisetteChoice['mode']) => void
}

/** Automatic or Choose a server, and what that means now. */
export const ModeSwitch = ({ choice, onChange }: ModeSwitchProps) => {
  const { t } = useTranslation()
  const onSelectionChange = (keys: Set<Key>) => {
    const [selected] = keys
    const mode = anisetteModes.find((candidate) => candidate === selected)
    if (mode) onChange(mode)
  }
  const chosen = choice.mode === 'chosen' ? choice.server : undefined
  const hint = chosen
    ? t('settings.anisette.modeHint.chosen', { name: chosen.name })
    : t(modeHintKeys[choice.mode])

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleButtonGroup
        aria-label={t('settings.anisette.modeLabel')}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[choice.mode]}
        onSelectionChange={onSelectionChange}
        className="flex-wrap"
      >
        {anisetteModes.map((mode) => (
          <ToggleButton key={mode} id={mode}>
            {t(modeLabelKeys[mode])}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <span className="text-muted text-sm">{hint}</span>
    </div>
  )
}
